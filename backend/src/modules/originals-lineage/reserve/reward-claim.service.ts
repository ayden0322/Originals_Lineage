import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import Redis from 'ioredis';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import {
  RewardClaim,
  RewardClaimStatus,
} from './entities/reward-claim.entity';
import { GameDbService } from '../game-db/game-db.service';
import { MilestoneValidationService } from './milestone-validation.service';
import { REDIS_CLIENT } from '../../../core/database/redis.module';

const EVT_DISTRIBUTE = 'reservation.distribute';
/** 每一筆 claim 的重試間隔（毫秒）。第一次立即嘗試，其後三次遞增等待。 */
const RETRY_DELAYS_MS = [0, 30_000, 60_000, 90_000] as const;
/** 單一批次的並行 worker 數；太高會壓垮遊戲 DB，太低會卡太久。 */
const CONCURRENCY = 5;
/** processing 狀態視為卡住的門檻；超過即被補救 cron 介入。 */
const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
/** recoverStuckClaims cron 全域鎖，避免多實例同時跑。 */
const RECOVER_LOCK_KEY = 'reserve:recover:lock';

@Injectable()
export class RewardClaimService {
  private readonly logger = new Logger(RewardClaimService.name);

  constructor(
    @InjectRepository(RewardClaim)
    private readonly claimRepo: Repository<RewardClaim>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationMilestone)
    private readonly milestoneRepo: Repository<ReservationMilestone>,
    private readonly validation: MilestoneValidationService,
    private readonly gameDbService: GameDbService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ════════════════════════════════════════════════════════════════
  //  Admin API — 啟動發放
  // ════════════════════════════════════════════════════════════════

  /**
   * 開始單一里程碑發放：
   *   1. 先跑 validation（未綁道具、未達標、遊戲 DB 斷線等）
   *   2. 在 DB transaction 內為所有尚未建立 claim 的預約者建立 pending
   *   3. 發送事件交由背景 handler 處理實際寄送
   *   4. 立即回傳給 caller（不阻塞 HTTP）
   */
  async startDistribution(
    milestoneId: string,
    operatorId: string | null,
  ): Promise<{
    created: number;
    skipped: number;
    totalReservations: number;
    queued: boolean;
  }> {
    const result = await this.validation.validateCanDistribute(milestoneId);
    if (!result.ok) {
      throw new BadRequestException({
        message: '發放前檢查未通過',
        issues: result.issues,
      });
    }

    const stats = await this.createPendingClaimsForMilestone(milestoneId);

    // 即使這次 0 created（例如先前跑過），仍 queue 一次事件讓背景把殘留的 pending/failed 帶走
    this.eventEmitter.emit(EVT_DISTRIBUTE, {
      milestoneId,
      operatorId,
      queuedAt: Date.now(),
    });

    return {
      ...stats,
      queued: true,
    };
  }

  /**
   * 一鍵發放所有「已達標且綁定道具」的里程碑。
   * 任何單一里程碑失敗不影響其他。
   */
  async startDistributionForAllReached(operatorId: string | null): Promise<{
    startedMilestoneIds: string[];
    perMilestone: Array<{ milestoneId: string; created: number; skipped: number }>;
  }> {
    const ids = await this.validation.listReadyMilestoneIds();
    const perMilestone: Array<{
      milestoneId: string;
      created: number;
      skipped: number;
    }> = [];

    for (const id of ids) {
      try {
        const stats = await this.createPendingClaimsForMilestone(id);
        perMilestone.push({
          milestoneId: id,
          created: stats.created,
          skipped: stats.skipped,
        });
        this.eventEmitter.emit(EVT_DISTRIBUTE, {
          milestoneId: id,
          operatorId,
          queuedAt: Date.now(),
        });
      } catch (err) {
        this.logger.error(
          `[startDistributionForAllReached] milestone=${id} 失敗: ${(err as Error).message}`,
        );
      }
    }

    return { startedMilestoneIds: ids, perMilestone };
  }

  /**
   * 只建立 pending claim，不觸發寄送。包在 transaction 內確保原子性。
   * 冪等：UNIQUE(reservation_id, milestone_id) + 事前過濾。
   */
  private async createPendingClaimsForMilestone(milestoneId: string): Promise<{
    created: number;
    skipped: number;
    totalReservations: number;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const milestone = await manager.findOne(ReservationMilestone, {
        where: { id: milestoneId },
      });
      if (!milestone) {
        throw new NotFoundException('里程碑不存在');
      }

      const reservations = await manager.find(Reservation);
      const existing = await manager.find(RewardClaim, {
        where: { milestoneId },
        select: ['reservationId'],
      });
      const existingIds = new Set(existing.map((c) => c.reservationId));
      const toCreate = reservations.filter((r) => !existingIds.has(r.id));

      if (toCreate.length === 0) {
        return {
          created: 0,
          skipped: reservations.length,
          totalReservations: reservations.length,
        };
      }

      const claims = toCreate.map((r) =>
        manager.create(RewardClaim, {
          reservationId: r.id,
          milestoneId,
          gameAccountSnapshot: r.gameAccountName,
          rewardNameSnapshot: milestone.rewardName,
          status: 'pending' as RewardClaimStatus,
          retryCount: 0,
        }),
      );
      await manager.save(claims);

      return {
        created: toCreate.length,
        skipped: reservations.length - toCreate.length,
        totalReservations: reservations.length,
      };
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  背景寄送 — event 驅動 + 並行 worker + 重試 + 反查
  // ════════════════════════════════════════════════════════════════

  /**
   * 事件監聽：為某里程碑撈出所有 pending / failed claim，並行處理。
   * async listener，不阻塞事件發送者。
   */
  @OnEvent(EVT_DISTRIBUTE, { async: true, promisify: true })
  async handleDistributeEvent(payload: {
    milestoneId: string;
    operatorId: string | null;
  }): Promise<void> {
    const { milestoneId, operatorId } = payload;
    this.logger.log(`[distribute] milestone=${milestoneId} 開始背景寄送`);

    // 批次寄送前做一次整體健檢；若斷線就全部卡 pending 等下一次重試或補救
    const healthy = await this.gameDbService.healthCheck();
    if (!healthy) {
      this.logger.warn(
        `[distribute] milestone=${milestoneId} 遊戲 DB 健檢失敗，本次事件中止，稍後由 recover cron 接手`,
      );
      return;
    }

    const pending = await this.claimRepo.find({
      where: [
        { milestoneId, status: 'pending' as RewardClaimStatus },
        { milestoneId, status: 'failed' as RewardClaimStatus },
      ],
      order: { createdAt: 'ASC' },
    });
    if (pending.length === 0) return;

    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
    });
    if (!milestone || !milestone.gameItemId) {
      this.logger.error(
        `[distribute] milestone=${milestoneId} 在寄送階段發現未綁道具，終止`,
      );
      return;
    }

    // 限制並行數，避免壓垮遊戲 DB
    const queue = [...pending];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const claim = queue.shift();
        if (!claim) return;
        try {
          await this.processSingleClaim(claim.id, milestone, operatorId);
        } catch (err) {
          // processSingleClaim 內部會 handle，不該 throw；但防萬一
          this.logger.error(
            `[distribute] claim=${claim.id} worker 捕獲例外: ${(err as Error).message}`,
          );
        }
      }
    });
    await Promise.all(workers);
    this.logger.log(
      `[distribute] milestone=${milestoneId} 本輪處理 ${pending.length} 筆 claim 完成`,
    );
  }

  /**
   * 單筆 claim 的寄送流程：
   *   1. atomic UPDATE 把 pending/failed 搶領為 processing（避免重複發）
   *   2. 4 次重試（0s/30s/60s/90s）內嘗試寫遊戲 DB
   *   3. 每次寫入成功後 SELECT 反查確認真的落盤
   *   4. 成功 → mark sent（含 gameInsertId）；全失敗 → mark failed
   */
  private async processSingleClaim(
    claimId: string,
    milestone: ReservationMilestone,
    operatorId: string | null,
  ): Promise<void> {
    // 1. atomic 搶領：pending/failed → processing。
    //    搶不到代表別的 worker 正在處理或已完成，直接放棄。
    const claimAtTake = await this.tryClaimProcessing(claimId);
    if (!claimAtTake) return;

    let lastError: string | null = null;
    let attempt = 0;

    for (const delay of RETRY_DELAYS_MS) {
      attempt += 1;
      if (delay > 0) {
        await sleep(delay);
      }

      try {
        if (!(await this.gameDbService.healthCheck())) {
          throw new Error('遊戲 DB 健檢失敗');
        }

        const insertId = await this.gameDbService.insertGiftReward(
          claimAtTake.gameAccountSnapshot,
          milestone.gameItemId as number,
          milestone.gameItemName ?? milestone.rewardName,
          milestone.gameItemQuantity ?? 1,
        );
        if (!insertId || insertId <= 0) {
          throw new Error('INSERT 未回傳 insertId');
        }

        // 寫入後反查確認；若 PK 非 id（很少見）會回 false，保守視為失敗重試
        const verified = await this.gameDbService.verifyGiftRewardExists(insertId);
        if (!verified) {
          // 寫入但反查失敗：若是反查邏輯本身有問題，會讓後續重試重複寫入。
          // 為降低重複風險，這裡把 insertId 存起來以便 recovery cron 判斷。
          await this.claimRepo.update(claimId, {
            gameInsertId: insertId,
            retryCount: attempt,
            lastAttemptAt: new Date(),
          });
          throw new Error(`INSERT id=${insertId} 反查失敗`);
        }

        await this.claimRepo.update(claimId, {
          status: 'sent' as RewardClaimStatus,
          gameInsertId: insertId,
          sentAt: new Date(),
          sentBy: operatorId,
          retryCount: attempt,
          lastAttemptAt: new Date(),
          note: null,
        });
        return;
      } catch (err) {
        lastError = (err as Error).message;
        this.logger.warn(
          `[processClaim] claim=${claimId} 嘗試 ${attempt}/${RETRY_DELAYS_MS.length} 失敗: ${lastError}`,
        );
      }
    }

    // 全部重試失敗
    await this.claimRepo.update(claimId, {
      status: 'failed' as RewardClaimStatus,
      retryCount: attempt,
      lastAttemptAt: new Date(),
      note: `重試 ${RETRY_DELAYS_MS.length} 次仍失敗：${lastError ?? '未知錯誤'}`,
    });
  }

  /**
   * atomic UPDATE：只把 pending 或 failed 搶領為 processing。
   * 回傳被搶到的 claim（附帶 snapshot 欄位），若回 null 代表搶不到。
   */
  private async tryClaimProcessing(
    claimId: string,
  ): Promise<RewardClaim | null> {
    const result = await this.claimRepo
      .createQueryBuilder()
      .update(RewardClaim)
      .set({
        status: 'processing' as RewardClaimStatus,
        lastAttemptAt: new Date(),
      })
      .where('id = :id AND status IN (:...allowed)', {
        id: claimId,
        allowed: ['pending', 'failed'] as RewardClaimStatus[],
      })
      .execute();

    if ((result.affected ?? 0) === 0) return null;

    // 重新讀取取得 snapshot 欄位（processing 狀態）
    return this.claimRepo.findOne({ where: { id: claimId } });
  }

  // ════════════════════════════════════════════════════════════════
  //  補救 cron — 掃卡住的 processing，靠 gameInsertId 判斷生死
  // ════════════════════════════════════════════════════════════════

  /**
   * 每 10 分鐘掃一次「processing 超過 5 分鐘」的 claim：
   *   - 若有 gameInsertId 且遊戲 DB 反查存在 → 代表已寫入，標 sent
   *   - 否則 → 退回 pending（下次事件或手動觸發時會重跑）
   *
   * 用 Redis SET NX 鎖防止多 pod 同時跑。
   */
  @Cron('*/10 * * * *', { name: 'reserve-recover-stuck-claims' })
  async recoverStuckClaims(): Promise<void> {
    const acquired = await this.redis.set(
      RECOVER_LOCK_KEY,
      String(Date.now()),
      'EX',
      600,
      'NX',
    );
    if (!acquired) return;

    try {
      const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
      const stuck = await this.claimRepo.find({
        where: {
          status: 'processing' as RewardClaimStatus,
          lastAttemptAt: LessThan(threshold),
        },
        take: 500,
      });
      if (stuck.length === 0) return;

      this.logger.warn(
        `[recoverStuckClaims] 發現 ${stuck.length} 筆卡住的 processing claim，開始補救`,
      );

      for (const claim of stuck) {
        try {
          if (claim.gameInsertId) {
            const exists = await this.gameDbService.verifyGiftRewardExists(
              claim.gameInsertId,
            );
            if (exists) {
              await this.claimRepo.update(claim.id, {
                status: 'sent' as RewardClaimStatus,
                sentAt: claim.sentAt ?? new Date(),
                note: `補救 cron 從 processing 回收為 sent（反查 gameInsertId=${claim.gameInsertId}）`,
              });
              continue;
            }
          }
          // 沒有 insertId 或反查不到 → 退回 pending 重跑
          await this.claimRepo
            .createQueryBuilder()
            .update(RewardClaim)
            .set({
              status: 'pending' as RewardClaimStatus,
              note: '補救 cron 從卡住的 processing 退回 pending',
            })
            .where('id = :id AND status = :processing', {
              id: claim.id,
              processing: 'processing' as RewardClaimStatus,
            })
            .execute();
        } catch (err) {
          this.logger.error(
            `[recoverStuckClaims] claim=${claim.id} 補救失敗: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      await this.redis.del(RECOVER_LOCK_KEY);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  里程碑編輯規則（供 Controller 查詢與同步 snapshot）
  // ════════════════════════════════════════════════════════════════

  /**
   * 判斷某里程碑目前是否可編輯「綁定道具」：
   *   - 有任何 sent/processing → 不可編輯（鎖死）
   *   - 有 pending/failed → 可編輯，但會同步更新這些 claim 的 snapshot
   *   - 完全沒 claim → 自由編輯
   */
  async getEditabilityForMilestone(milestoneId: string): Promise<{
    canEdit: boolean;
    reason: string | null;
    pendingCount: number;
    processingCount: number;
    sentCount: number;
    failedCount: number;
  }> {
    const rows = (await this.claimRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('c.milestone_id = :id', { id: milestoneId })
      .groupBy('c.status')
      .getRawMany()) as Array<{ status: RewardClaimStatus; count: string }>;

    const counts = { pending: 0, processing: 0, sent: 0, failed: 0 };
    for (const r of rows) counts[r.status] = parseInt(r.count, 10);

    if (counts.sent > 0 || counts.processing > 0) {
      return {
        canEdit: false,
        reason:
          counts.sent > 0
            ? `已寄送 ${counts.sent} 筆，不可變更道具（請新增里程碑處理補發）`
            : `尚有 ${counts.processing} 筆寄送中，請待完成後再變更`,
        pendingCount: counts.pending,
        processingCount: counts.processing,
        sentCount: counts.sent,
        failedCount: counts.failed,
      };
    }
    return {
      canEdit: true,
      reason: null,
      pendingCount: counts.pending,
      processingCount: counts.processing,
      sentCount: counts.sent,
      failedCount: counts.failed,
    };
  }

  /**
   * 當管理員變更里程碑綁定道具時，同步更新所有 pending/failed claim 的
   * rewardNameSnapshot，使後續寄送用新道具名稱。
   */
  async syncPendingSnapshotsAfterMilestoneEdit(
    milestoneId: string,
    newRewardName: string,
  ): Promise<{ updated: number }> {
    const result = await this.claimRepo
      .createQueryBuilder()
      .update(RewardClaim)
      .set({ rewardNameSnapshot: newRewardName })
      .where(
        'milestone_id = :id AND status IN (:...editable)',
        {
          id: milestoneId,
          editable: ['pending', 'failed'] as RewardClaimStatus[],
        },
      )
      .execute();
    return { updated: result.affected ?? 0 };
  }

  // ════════════════════════════════════════════════════════════════
  //  Admin 查詢 API — 沿用原有邏輯，狀態統計納入 processing
  // ════════════════════════════════════════════════════════════════

  async getDistributionSummary(): Promise<
    Array<{
      milestoneId: string;
      rewardName: string;
      threshold: number;
      pending: number;
      processing: number;
      sent: number;
      failed: number;
      total: number;
    }>
  > {
    const milestones = await this.milestoneRepo.find({
      order: { sortOrder: 'ASC', threshold: 'ASC' },
    });

    const rows = await this.claimRepo
      .createQueryBuilder('c')
      .select('c.milestone_id', 'milestoneId')
      .addSelect('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.milestone_id')
      .addGroupBy('c.status')
      .getRawMany<{
        milestoneId: string;
        status: RewardClaimStatus;
        count: string;
      }>();

    type StatusCounts = {
      pending: number;
      processing: number;
      sent: number;
      failed: number;
    };
    const empty = (): StatusCounts => ({
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
    });

    const byMilestone = new Map<string, StatusCounts>();
    for (const row of rows) {
      const entry = byMilestone.get(row.milestoneId) ?? empty();
      entry[row.status] = parseInt(row.count, 10);
      byMilestone.set(row.milestoneId, entry);
    }

    return milestones.map((m) => {
      const s = byMilestone.get(m.id) ?? empty();
      return {
        milestoneId: m.id,
        rewardName: m.rewardName,
        threshold: m.threshold,
        pending: s.pending,
        processing: s.processing,
        sent: s.sent,
        failed: s.failed,
        total: s.pending + s.processing + s.sent + s.failed,
      };
    });
  }

  async findClaimsByMilestone(
    milestoneId: string,
    status?: RewardClaimStatus,
    page = 1,
    limit = 50,
  ): Promise<{
    data: RewardClaim[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.claimRepo
      .createQueryBuilder('c')
      .where('c.milestone_id = :milestoneId', { milestoneId });

    if (status) {
      qb.andWhere('c.status = :status', { status });
    }

    qb.orderBy('c.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async markClaimsStatus(
    claimIds: string[],
    status: RewardClaimStatus,
    operatorId?: string,
    note?: string,
  ): Promise<{ updated: number }> {
    if (claimIds.length === 0) {
      throw new BadRequestException('請至少選擇一筆紀錄');
    }

    const patch: Partial<RewardClaim> = { status };
    if (note !== undefined) patch.note = note;
    if (status === 'sent') {
      patch.sentAt = new Date();
      patch.sentBy = operatorId ?? null;
    } else {
      patch.sentAt = null;
      patch.sentBy = null;
    }

    const result = await this.claimRepo.update({ id: In(claimIds) }, patch);
    return { updated: result.affected ?? 0 };
  }

  async findMyClaims(
    websiteUserId: string,
  ): Promise<
    Array<{
      id: string;
      milestoneId: string;
      rewardName: string;
      status: RewardClaimStatus;
      sentAt: Date | null;
      createdAt: Date;
    }>
  > {
    const reservation = await this.reservationRepo.findOne({
      where: { websiteUserId },
    });
    if (!reservation) return [];

    const claims = await this.claimRepo.find({
      where: { reservationId: reservation.id },
      order: { createdAt: 'ASC' },
    });

    return claims.map((c) => ({
      id: c.id,
      milestoneId: c.milestoneId,
      rewardName: c.rewardNameSnapshot,
      status: c.status,
      sentAt: c.sentAt,
      createdAt: c.createdAt,
    }));
  }

  /**
   * 保留舊 API 名稱，供既有 Controller 在 Phase 3 替換前繼續可用。
   * 行為等同 createPendingClaimsForMilestone，不觸發事件。
   */
  async distributeMilestone(
    milestoneId: string,
  ): Promise<{
    created: number;
    skipped: number;
    totalReservations: number;
  }> {
    return this.createPendingClaimsForMilestone(milestoneId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
