import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import { ReservationPageSettings } from './entities/reservation-page-settings.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { UpdatePageSettingsDto } from './dto/update-page-settings.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { REDIS_CLIENT } from '../../../core/database/redis.module';

const REDIS_RESERVE_COUNT_KEY = 'reserve:count';
const REDIS_RESERVE_COUNT_TTL = 60;

@Injectable()
export class ReserveService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationMilestone)
    private readonly milestoneRepo: Repository<ReservationMilestone>,
    @InjectRepository(ReservationPageSettings)
    private readonly pageSettingsRepo: Repository<ReservationPageSettings>,
    @InjectRepository(MemberBinding)
    private readonly memberBindingRepo: Repository<MemberBinding>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ─── Public: 取得預約狀態（人數 + 里程碑 + deadline + 我是否已預約）────

  async getPublicStatus(websiteUserId?: string): Promise<{
    displayCount: number;
    milestones: ReservationMilestone[];
    pageSettings: Partial<ReservationPageSettings>;
    myReservation: { reserved: boolean; createdAt?: Date; gameAccountName?: string };
  }> {
    const [actualCount, milestones, settings] = await Promise.all([
      this.getActualCount(),
      this.milestoneRepo.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC', threshold: 'ASC' },
      }),
      this.getOrCreatePageSettings(),
    ]);

    const displayCount = settings.countBase + actualCount;

    // 查詢目前使用者是否已預約
    let myReservation: { reserved: boolean; createdAt?: Date; gameAccountName?: string } = {
      reserved: false,
    };

    if (websiteUserId) {
      const existing = await this.reservationRepo.findOne({
        where: { websiteUserId },
      });
      if (existing) {
        myReservation = {
          reserved: true,
          createdAt: existing.createdAt,
          gameAccountName: existing.gameAccountName,
        };
      }
    }

    return {
      displayCount,
      milestones,
      pageSettings: {
        pageTitle: settings.pageTitle,
        pageSubtitle: settings.pageSubtitle,
        pageDescription: settings.pageDescription,
        deadlineAt: settings.deadlineAt,
        isDistributionLocked: settings.isDistributionLocked,
        heroBackgroundUrl: settings.heroBackgroundUrl,
        heroOverlayOpacity: settings.heroOverlayOpacity,
      },
      myReservation,
    };
  }

  // ─── Public: 建立預約 ────────────────────────────────────────────

  async create(
    websiteUserId: string,
    ipAddress: string | null,
  ): Promise<Reservation> {
    // 檢查是否已預約
    const existing = await this.reservationRepo.findOne({
      where: { websiteUserId },
    });
    if (existing) {
      throw new ConflictException('您已完成新兵報到');
    }

    // 檢查 deadline
    const settings = await this.getOrCreatePageSettings();
    if (settings.isDistributionLocked) {
      throw new ForbiddenException('預約活動已結束');
    }
    if (settings.deadlineAt && new Date() >= settings.deadlineAt) {
      throw new ForbiddenException('預約活動已截止');
    }

    // 取得遊戲帳號綁定
    const binding = await this.memberBindingRepo.findOne({
      where: { websiteAccountId: websiteUserId },
    });
    if (!binding || binding.bindingStatus === 'unbound') {
      throw new BadRequestException('請先綁定遊戲帳號後再進行預約');
    }

    const reservation = this.reservationRepo.create({
      websiteUserId,
      gameAccountName: binding.gameAccountName,
      ipAddress,
    });

    const saved = await this.reservationRepo.save(reservation);

    // 更新 Redis 計數
    const cacheExists = await this.redis.exists(REDIS_RESERVE_COUNT_KEY);
    if (cacheExists) {
      await this.redis.incr(REDIS_RESERVE_COUNT_KEY);
    }

    return saved;
  }

  // ─── Admin: 預約列表 ────────────────────────────────────────────

  async findAll(
    page: number,
    limit: number,
    keyword?: string,
  ): Promise<{ data: Reservation[]; total: number; page: number; limit: number }> {
    const qb = this.reservationRepo.createQueryBuilder('r');

    if (keyword) {
      qb.where('r.game_account_name ILIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }

    qb.orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  // ─── Admin: 預約統計 ────────────────────────────────────────────

  async getStats(): Promise<{
    actualCount: number;
    countBase: number;
    displayCount: number;
  }> {
    const [actualCount, settings] = await Promise.all([
      this.getActualCount(),
      this.getOrCreatePageSettings(),
    ]);

    return {
      actualCount,
      countBase: settings.countBase,
      displayCount: settings.countBase + actualCount,
    };
  }

  // ─── Admin: 頁面設定 ────────────────────────────────────────────

  async getPageSettings(): Promise<ReservationPageSettings> {
    return this.getOrCreatePageSettings();
  }

  async updatePageSettings(
    dto: UpdatePageSettingsDto,
  ): Promise<ReservationPageSettings> {
    const settings = await this.getOrCreatePageSettings();
    Object.assign(settings, dto);
    return this.pageSettingsRepo.save(settings);
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

  // ─── Admin: 匯出 CSV ───────────────────────────────────────────

  async exportCsv(): Promise<string> {
    const reservations = await this.reservationRepo.find({
      order: { createdAt: 'DESC' },
    });

    const header = 'gameAccountName,websiteUserId,ipAddress,createdAt';
    const rows = reservations.map((r) => {
      return [
        this.escapeCsvField(r.gameAccountName),
        r.websiteUserId,
        r.ipAddress ?? '',
        r.createdAt.toISOString(),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  // ─── Private helpers ────────────────────────────────────────────

  private async getActualCount(): Promise<number> {
    const cached = await this.redis.get(REDIS_RESERVE_COUNT_KEY);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    const count = await this.reservationRepo.count();
    await this.redis.set(
      REDIS_RESERVE_COUNT_KEY,
      count,
      'EX',
      REDIS_RESERVE_COUNT_TTL,
    );
    return count;
  }

  private async getOrCreatePageSettings(): Promise<ReservationPageSettings> {
    const existing = await this.pageSettingsRepo.find({ take: 1 });
    if (existing.length > 0) {
      return existing[0];
    }

    // 自動建立預設設定（單筆）
    const settings = this.pageSettingsRepo.create({
      pageTitle: '新兵報到活動',
      countBase: 0,
      isDistributionLocked: false,
    });
    return this.pageSettingsRepo.save(settings);
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
