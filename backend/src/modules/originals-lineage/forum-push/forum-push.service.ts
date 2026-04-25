import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { ForumPushApplication } from './entities/forum-push-application.entity';
import { ForumPushItem } from './entities/forum-push-item.entity';
import { ForumPushRewardConfig } from './entities/forum-push-reward-config.entity';
import { ForumPushSettings } from './entities/forum-push-settings.entity';
import { WebsiteUser } from '../member/entities/website-user.entity';
import { GameDbService } from '../game-db/game-db.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { UpsertRewardConfigDto } from './dto/reward-config.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** 把 URL 正規化成可比對的 key：去掉 query / fragment / 結尾斜線，去除大小寫差異 */
function normalizeUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const path = u.pathname.replace(/\/+$/, '').toLowerCase();
    return `${u.host.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

@Injectable()
export class ForumPushService {
  private readonly logger = new Logger(ForumPushService.name);

  constructor(
    @InjectRepository(ForumPushApplication)
    private readonly appRepo: Repository<ForumPushApplication>,
    @InjectRepository(ForumPushItem)
    private readonly itemRepo: Repository<ForumPushItem>,
    @InjectRepository(ForumPushRewardConfig)
    private readonly rewardConfigRepo: Repository<ForumPushRewardConfig>,
    @InjectRepository(ForumPushSettings)
    private readonly settingsRepo: Repository<ForumPushSettings>,
    @InjectRepository(WebsiteUser)
    private readonly userRepo: Repository<WebsiteUser>,
    private readonly dataSource: DataSource,
    private readonly gameDbService: GameDbService,
  ) {}

  // ─── 全域設定（singleton） ───────────────────────────────────

  async getOrCreateSettings(): Promise<ForumPushSettings> {
    const existing = await this.settingsRepo.find({ take: 1 });
    if (existing.length > 0) return existing[0];
    const created = this.settingsRepo.create({});
    return this.settingsRepo.save(created);
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<ForumPushSettings> {
    const settings = await this.getOrCreateSettings();
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  // ─── 遊戲道具搜尋（供下拉用） ────────────────────────────────

  async searchGameItems(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: Array<{ itemId: number; name: string }>; total: number }> {
    if (!this.gameDbService.isConnected) {
      return { items: [], total: 0 };
    }
    return this.gameDbService.findGameItems(search, page, limit);
  }

  // ─── 獎勵道具設定 ─────────────────────────────────────────────

  async listRewardConfigs(): Promise<ForumPushRewardConfig[]> {
    return this.rewardConfigRepo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createRewardConfig(
    dto: UpsertRewardConfigDto,
  ): Promise<ForumPushRewardConfig> {
    const entity = this.rewardConfigRepo.create(dto);
    return this.rewardConfigRepo.save(entity);
  }

  async updateRewardConfig(
    id: string,
    dto: Partial<UpsertRewardConfigDto>,
  ): Promise<ForumPushRewardConfig> {
    const existing = await this.rewardConfigRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('獎勵設定不存在');
    Object.assign(existing, dto);
    return this.rewardConfigRepo.save(existing);
  }

  async deleteRewardConfig(id: string): Promise<void> {
    await this.rewardConfigRepo.delete(id);
  }

  // ─── Public: 前台狀態 + 預設值 ───────────────────────────────

  /**
   * 取得會員今日可送次數、上限、上次填的 FB 資訊（用於自動帶入）、遊戲帳號
   */
  async getPublicStatus(websiteUserId: string): Promise<{
    settings: {
      maxApplicationsPerDay: number;
      maxItemsPerApplication: number;
      duplicateUrlPolicy: 'warn' | 'block';
      pageDescription: string | null;
    };
    todayUsed: number;
    remainingToday: number;
    gameAccount: string | null;
    gameCharacters: string[];
    lastFbName: string | null;
    lastFbLink: string | null;
  }> {
    const settings = await this.getOrCreateSettings();
    const user = await this.userRepo.findOne({
      where: { id: websiteUserId },
    });

    const todayUsed = await this.countApplicationsToday(websiteUserId);
    const remainingToday = Math.max(
      settings.maxApplicationsPerDay - todayUsed,
      0,
    );

    let gameCharacters: string[] = [];
    if (user?.gameAccountName && this.gameDbService.isConnected) {
      try {
        const rows = await this.gameDbService.findCharactersByAccount(
          user.gameAccountName,
        );
        gameCharacters = (rows as Array<{ char_name?: string }>).map(
          (r) => r.char_name ?? '',
        ).filter(Boolean);
      } catch (err) {
        this.logger.warn(
          `findCharactersByAccount failed: ${(err as Error).message}`,
        );
      }
    }

    // 取最近一筆申請當作 FB 資訊預設值
    const last = await this.appRepo.findOne({
      where: { websiteUserId },
      order: { createdAt: 'DESC' },
    });

    return {
      settings: {
        maxApplicationsPerDay: settings.maxApplicationsPerDay,
        maxItemsPerApplication: settings.maxItemsPerApplication,
        duplicateUrlPolicy: settings.duplicateUrlPolicy,
        pageDescription: settings.pageDescription,
      },
      todayUsed,
      remainingToday,
      gameAccount: user?.gameAccountName ?? null,
      gameCharacters,
      lastFbName: last?.fbName ?? null,
      lastFbLink: last?.fbLink ?? null,
    };
  }

  private async countApplicationsToday(
    websiteUserId: string,
  ): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.appRepo.count({
      where: {
        websiteUserId,
        createdAt: Between(start, end),
      },
    });
  }

  // ─── Public: 送出申請 ─────────────────────────────────────────

  async submit(
    websiteUserId: string,
    dto: SubmitApplicationDto,
    ipAddress: string | null,
  ): Promise<ForumPushApplication> {
    const user = await this.userRepo.findOne({
      where: { id: websiteUserId },
    });
    if (!user) throw new ForbiddenException('使用者不存在');
    if (!user.gameAccountName) {
      throw new BadRequestException('會員尚未設定遊戲帳號');
    }

    const settings = await this.getOrCreateSettings();

    // 檢查今日上限
    const todayUsed = await this.countApplicationsToday(websiteUserId);
    if (todayUsed >= settings.maxApplicationsPerDay) {
      throw new ConflictException(
        `今日申請次數已達上限（${settings.maxApplicationsPerDay} 次）`,
      );
    }

    // 檢查每筆上限
    if (dto.items.length > settings.maxItemsPerApplication) {
      throw new BadRequestException(
        `每次申請最多 ${settings.maxItemsPerApplication} 筆`,
      );
    }

    // 驗證每筆 item 的 content
    for (const item of dto.items) {
      if (item.type === 'link') {
        try {
          new URL(item.content);
        } catch {
          throw new BadRequestException('推文連結格式不正確');
        }
      }
    }

    // block 模式下，直接擋掉跨申請重複連結
    if (settings.duplicateUrlPolicy === 'block') {
      const normalizedUrls = dto.items
        .filter((i) => i.type === 'link')
        .map((i) => normalizeUrl(i.content))
        .filter((u): u is string => !!u);
      if (normalizedUrls.length > 0) {
        const dup = await this.itemRepo.findOne({
          where: { normalizedUrl: In(normalizedUrls) },
        });
        if (dup) {
          throw new ConflictException(
            '有推文連結先前已申請過，請勿重複提交',
          );
        }
      }
    }

    // 寫入（主檔 + 子檔 in transaction）
    return this.dataSource.transaction(async (manager) => {
      const app = manager.create(ForumPushApplication, {
        websiteUserId,
        gameAccount: user.gameAccountName,
        gameCharacter: dto.gameCharacter ?? null,
        fbName: dto.fbName,
        fbLink: dto.fbLink,
        status: 'pending',
        ipAddress,
      });
      const savedApp = await manager.save(app);

      const items = dto.items.map((it, idx) =>
        manager.create(ForumPushItem, {
          applicationId: savedApp.id,
          sortOrder: idx,
          type: it.type,
          content: it.content,
          normalizedUrl:
            it.type === 'link' ? normalizeUrl(it.content) : null,
          reviewResult: 'pending',
        }),
      );
      await manager.save(items);

      return savedApp;
    });
  }

  // ─── Public: 會員看自己的申請 ────────────────────────────────

  async findMyApplications(
    websiteUserId: string,
  ): Promise<
    Array<
      ForumPushApplication & {
        items: ForumPushItem[];
      }
    >
  > {
    const apps = await this.appRepo.find({
      where: { websiteUserId },
      order: { createdAt: 'DESC' },
    });
    if (apps.length === 0) return [];
    const items = await this.itemRepo.find({
      where: { applicationId: In(apps.map((a) => a.id)) },
      order: { sortOrder: 'ASC' },
    });
    const map = new Map<string, ForumPushItem[]>();
    for (const it of items) {
      const list = map.get(it.applicationId) ?? [];
      list.push(it);
      map.set(it.applicationId, list);
    }
    return apps.map((a) => ({ ...a, items: map.get(a.id) ?? [] }));
  }

  // ─── Admin: 列表 / 詳情 ──────────────────────────────────────

  async findAll(params: {
    page: number;
    limit: number;
    status?: string;
    keyword?: string;
    from?: string;
    to?: string;
  }): Promise<{
    data: ForumPushApplication[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, status, keyword, from, to } = params;
    const qb = this.appRepo.createQueryBuilder('a').orderBy('a.created_at', 'DESC');

    if (status) qb.andWhere('a.status = :status', { status });
    if (keyword) {
      qb.andWhere(
        '(a.game_account ILIKE :kw OR a.game_character ILIKE :kw OR a.fb_name ILIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }
    if (from) qb.andWhere('a.created_at >= :from', { from });
    if (to) qb.andWhere('a.created_at <= :to', { to });

    qb.skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(
    id: string,
  ): Promise<{
    application: ForumPushApplication;
    items: Array<
      ForumPushItem & {
        duplicates?: Array<{ applicationId: string; createdAt: Date; reviewResult: string }>;
      }
    >;
  }> {
    const application = await this.appRepo.findOne({ where: { id } });
    if (!application) throw new NotFoundException('申請不存在');

    const items = await this.itemRepo.find({
      where: { applicationId: id },
      order: { sortOrder: 'ASC' },
    });

    // 比對重複連結（除了自己這筆申請的其他紀錄）
    const linkItems = items.filter(
      (i) => i.type === 'link' && i.normalizedUrl,
    );
    const dupMap = new Map<
      string,
      Array<{ applicationId: string; createdAt: Date; reviewResult: string }>
    >();
    if (linkItems.length > 0) {
      const urls = linkItems.map((i) => i.normalizedUrl as string);
      const rows = await this.itemRepo.find({
        where: { normalizedUrl: In(urls) },
        order: { createdAt: 'DESC' },
      });
      for (const r of rows) {
        if (r.applicationId === id || !r.normalizedUrl) continue;
        const list = dupMap.get(r.normalizedUrl) ?? [];
        list.push({
          applicationId: r.applicationId,
          createdAt: r.createdAt,
          reviewResult: r.reviewResult,
        });
        dupMap.set(r.normalizedUrl, list);
      }
    }

    return {
      application,
      items: items.map((i) => ({
        ...i,
        duplicates: i.normalizedUrl ? dupMap.get(i.normalizedUrl) ?? [] : [],
      })),
    };
  }

  // ─── Admin: 審核（儲存即發獎） ───────────────────────────────

  async review(
    id: string,
    dto: ReviewApplicationDto,
    operatorId: string,
  ): Promise<{
    application: ForumPushApplication;
    rewardDelivery: ForumPushApplication['rewardPayload'];
  }> {
    const application = await this.appRepo.findOne({ where: { id } });
    if (!application) throw new NotFoundException('申請不存在');
    if (application.status === 'reviewed') {
      throw new ConflictException('此申請已審核完成，不可重複審核');
    }

    const items = await this.itemRepo.find({
      where: { applicationId: id },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // 將送來的 review result 套用到 items
    for (const ri of dto.items) {
      const item = itemMap.get(ri.itemId);
      if (!item) {
        throw new BadRequestException(`itemId ${ri.itemId} 不屬於此申請`);
      }
      item.reviewResult = ri.result;
    }

    const passedCount = items.filter((i) => i.reviewResult === 'passed').length;

    // 發獎
    const { rewardStatus, rewardPayload } = await this.deliverRewards(
      application.gameAccount,
      passedCount,
    );

    // 更新 items + application（transaction）
    await this.dataSource.transaction(async (manager) => {
      await manager.save(items);
      application.status = 'reviewed';
      application.passedCount = passedCount;
      application.reviewNote = dto.reviewNote ?? null;
      application.reviewedBy = operatorId;
      application.reviewedAt = new Date();
      application.rewardStatus = rewardStatus;
      application.rewardPayload = rewardPayload;
      await manager.save(application);
    });

    return { application, rewardDelivery: rewardPayload };
  }

  /**
   * 根據通過筆數 × 每筆獎勵設定 → 呼叫遊戲庫寫入「輔助_獎勵發送」
   * 單獨抽出來，便於日後加重試、補發
   */
  private async deliverRewards(
    gameAccount: string,
    passedCount: number,
  ): Promise<{
    rewardStatus: 'pending' | 'sent' | 'partial' | 'failed';
    rewardPayload: ForumPushApplication['rewardPayload'];
  }> {
    if (passedCount <= 0) {
      return { rewardStatus: 'pending', rewardPayload: [] };
    }

    const configs = await this.rewardConfigRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    if (configs.length === 0) {
      return { rewardStatus: 'pending', rewardPayload: [] };
    }

    const payload: NonNullable<ForumPushApplication['rewardPayload']> = [];
    let successCount = 0;

    for (const cfg of configs) {
      const qty = cfg.quantityPerPass * passedCount;
      try {
        const insertId = await this.gameDbService.insertGiftReward(
          gameAccount,
          cfg.itemCode,
          cfg.itemName,
          qty,
        );
        payload.push({
          itemCode: cfg.itemCode,
          itemName: cfg.itemName,
          quantity: qty,
          insertId,
        });
        successCount++;
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.error(
          `[forum-push] deliverRewards failed account=${gameAccount} item=${cfg.itemCode}: ${msg}`,
        );
        payload.push({
          itemCode: cfg.itemCode,
          itemName: cfg.itemName,
          quantity: qty,
          error: msg,
        });
      }
    }

    let rewardStatus: 'sent' | 'partial' | 'failed';
    if (successCount === configs.length) rewardStatus = 'sent';
    else if (successCount === 0) rewardStatus = 'failed';
    else rewardStatus = 'partial';

    return { rewardStatus, rewardPayload: payload };
  }

  // ─── Admin: 刪除申請 ─────────────────────────────────────────

  async deleteApplication(id: string): Promise<void> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('申請不存在');
    // items 由 FK ON DELETE CASCADE 自動清除
    await this.appRepo.delete(id);
  }
}
