import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { REDIS_CLIENT } from '../../../core/database/redis.module';
import { ModuleConfigService } from '../../../core/module-config/module-config.service';

const REDIS_RESERVE_COUNT_KEY = 'reserve:count';
const REDIS_RESERVE_COUNT_TTL = 60;
const REDIS_RESEND_COOLDOWN_PREFIX = 'reserve:resend:';
const REDIS_RESEND_COOLDOWN_TTL = 60; // 60 秒內不可重新發送
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 分鐘
const MODULE_CODE = 'originals-lineage';

@Injectable()
export class ReserveService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationMilestone)
    private readonly milestoneRepo: Repository<ReservationMilestone>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly moduleConfigService: ModuleConfigService,
  ) {}

  // ─── Helper: 取得預約頁設定 ──────────────────────────────────────

  private async getReserveSettings(): Promise<Record<string, any>> {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    return config?.configJson?.['siteSettings'] || {};
  }

  // ─── Public: 建立預約 ────────────────────────────────────────────

  async create(
    dto: CreateReservationDto,
    ipAddress: string | null,
  ): Promise<Reservation> {
    const settings = await this.getReserveSettings();

    // 動態欄位驗證：根據 reserveFieldConfig 檢查必填欄位
    const fieldConfig = settings.reserveFieldConfig as
      | Record<string, { visible: boolean; required: boolean }>
      | undefined;

    if (fieldConfig) {
      const fieldMap: Record<string, string> = {
        displayName: 'displayName',
        phone: 'phone',
        lineId: 'lineId',
      };

      for (const [fieldKey, dtoKey] of Object.entries(fieldMap)) {
        const config = fieldConfig[fieldKey];
        if (config?.visible && config?.required) {
          const value = dto[dtoKey as keyof CreateReservationDto];
          if (!value || (typeof value === 'string' && !value.trim())) {
            throw new BadRequestException(`${fieldKey} 為必填欄位`);
          }
        }
      }
    }

    const existing = await this.reservationRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('此 Email 已被預約');
    }

    const emailVerificationEnabled = !!settings.reserveEmailVerificationEnabled;

    const reservation = this.reservationRepo.create({
      ...dto,
      displayName: dto.displayName || '',
      ipAddress,
      emailVerified: !emailVerificationEnabled, // 若未啟用驗證直接標記已驗證
    });

    // 若啟用 Email 驗證，產生驗證碼
    if (emailVerificationEnabled) {
      const code = this.generateVerificationCode();
      reservation.verificationCode = code;
      reservation.verificationCodeExpiresAt = new Date(
        Date.now() + VERIFICATION_CODE_TTL_MS,
      );
    }

    const saved = await this.reservationRepo.save(reservation);

    // 更新 Redis 計數
    const exists = await this.redis.exists(REDIS_RESERVE_COUNT_KEY);
    if (exists) {
      await this.redis.incr(REDIS_RESERVE_COUNT_KEY);
    }

    // 若啟用 Email 驗證，發送驗證信
    if (emailVerificationEnabled && saved.verificationCode) {
      await this.sendVerificationEmail(saved.email, saved.verificationCode);
    }

    return saved;
  }

  // ─── Public: Email 驗證 ──────────────────────────────────────────

  async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
    const reservation = await this.reservationRepo.findOne({
      where: { email },
    });

    if (!reservation) {
      throw new NotFoundException('找不到此預約');
    }

    if (reservation.emailVerified) {
      return { success: true, message: '此 Email 已完成驗證' };
    }

    if (!reservation.verificationCode) {
      throw new BadRequestException('未設定驗證碼');
    }

    if (
      reservation.verificationCodeExpiresAt &&
      reservation.verificationCodeExpiresAt < new Date()
    ) {
      throw new BadRequestException('驗證碼已過期，請重新發送');
    }

    if (reservation.verificationCode !== code) {
      throw new BadRequestException('驗證碼錯誤');
    }

    reservation.emailVerified = true;
    reservation.verificationCode = null;
    reservation.verificationCodeExpiresAt = null;
    reservation.status = 'confirmed';
    await this.reservationRepo.save(reservation);

    return { success: true, message: '驗證成功' };
  }

  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    // Redis 冷卻時間檢查
    const cooldownKey = `${REDIS_RESEND_COOLDOWN_PREFIX}${email}`;
    const cooldown = await this.redis.exists(cooldownKey);
    if (cooldown) {
      throw new BadRequestException('請稍後再重新發送驗證信');
    }

    const reservation = await this.reservationRepo.findOne({
      where: { email },
    });

    if (!reservation) {
      throw new NotFoundException('找不到此預約');
    }

    if (reservation.emailVerified) {
      return { success: true, message: '此 Email 已完成驗證' };
    }

    const code = this.generateVerificationCode();
    reservation.verificationCode = code;
    reservation.verificationCodeExpiresAt = new Date(
      Date.now() + VERIFICATION_CODE_TTL_MS,
    );
    await this.reservationRepo.save(reservation);

    // 設定 Redis 冷卻時間
    await this.redis.set(cooldownKey, '1', 'EX', REDIS_RESEND_COOLDOWN_TTL);

    await this.sendVerificationEmail(email, code);

    return { success: true, message: '驗證信已重新發送' };
  }

  // ─── Public: 取得預約人數 ────────────────────────────────────────

  async getPublicCount(): Promise<number> {
    const cached = await this.redis.get(REDIS_RESERVE_COUNT_KEY);

    if (cached !== null) {
      return parseInt(cached, 10);
    }

    const count = await this.reservationRepo.count();
    await this.redis.set(REDIS_RESERVE_COUNT_KEY, count, 'EX', REDIS_RESERVE_COUNT_TTL);

    return count;
  }

  // ─── Public: 取得公開里程碑 ──────────────────────────────────────

  async getPublicMilestones(): Promise<ReservationMilestone[]> {
    return this.milestoneRepo.find({
      where: { isActive: true },
      order: { threshold: 'ASC' },
    });
  }

  // ─── Admin: 里程碑 CRUD ──────────────────────────────────────────

  async findAllMilestones(): Promise<ReservationMilestone[]> {
    return this.milestoneRepo.find({
      order: { sortOrder: 'ASC', threshold: 'ASC' },
    });
  }

  async createMilestone(dto: CreateMilestoneDto): Promise<ReservationMilestone> {
    const milestone = this.milestoneRepo.create(dto);
    return this.milestoneRepo.save(milestone);
  }

  async updateMilestone(
    id: string,
    dto: UpdateMilestoneDto,
  ): Promise<ReservationMilestone> {
    const milestone = await this.milestoneRepo.findOne({ where: { id } });
    if (!milestone) {
      throw new NotFoundException('里程碑不存在');
    }
    Object.assign(milestone, dto);
    return this.milestoneRepo.save(milestone);
  }

  async deleteMilestone(id: string): Promise<void> {
    const milestone = await this.milestoneRepo.findOne({ where: { id } });
    if (!milestone) {
      throw new NotFoundException('里程碑不存在');
    }
    await this.milestoneRepo.remove(milestone);
  }

  // ─── Admin: 預約列表 ────────────────────────────────────────────

  async findAll(
    page: number,
    limit: number,
    status?: string,
  ): Promise<{ data: Reservation[]; total: number; page: number; limit: number }> {
    const where: Record<string, any> = {};

    if (status) {
      where.status = status;
    }

    const [data, total] = await this.reservationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  // ─── Admin: 預約統計 ────────────────────────────────────────────

  async getStats(): Promise<{
    total: number;
    registered: number;
    confirmed: number;
    converted: number;
  }> {
    const total = await this.reservationRepo.count();
    const registered = await this.reservationRepo.count({
      where: { status: 'registered' },
    });
    const confirmed = await this.reservationRepo.count({
      where: { status: 'confirmed' },
    });
    const converted = await this.reservationRepo.count({
      where: { status: 'converted' },
    });

    return { total, registered, confirmed, converted };
  }

  // ─── Admin: 更新預約狀態 ────────────────────────────────────────

  async updateStatus(
    id: string,
    status: 'registered' | 'confirmed' | 'converted',
  ): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOne({ where: { id } });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    reservation.status = status;
    return this.reservationRepo.save(reservation);
  }

  // ─── Admin: 匯出 CSV ───────────────────────────────────────────

  async exportCsv(): Promise<string> {
    const reservations = await this.reservationRepo.find({
      order: { createdAt: 'DESC' },
    });

    const header = 'email,displayName,phone,lineId,emailVerified,status,createdAt';
    const rows = reservations.map((r) => {
      return [
        this.escapeCsvField(r.email),
        this.escapeCsvField(r.displayName),
        this.escapeCsvField(r.phone ?? ''),
        this.escapeCsvField(r.lineId ?? ''),
        r.emailVerified ? 'Y' : 'N',
        r.status,
        r.createdAt.toISOString(),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  // ─── Private helpers ────────────────────────────────────────────

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendVerificationEmail(
    email: string,
    code: string,
  ): Promise<void> {
    // TODO: 整合 nodemailer 發送真實驗證信
    // 目前先用 console.log 作為 placeholder
    console.log(`[預約驗證] 發送驗證碼 ${code} 至 ${email}`);
  }
}
