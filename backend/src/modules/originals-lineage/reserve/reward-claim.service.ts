import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import {
  RewardClaim,
  RewardClaimStatus,
} from './entities/reward-claim.entity';

/**
 * 發獎服務
 *
 * 流程：
 *   1. 里程碑達成（actualCount >= threshold）
 *   2. admin 按「建立發放批次」→ distributeMilestone(milestoneId)
 *      會為當下所有實際預約者建立 pending claim
 *   3. admin 人工在遊戲後台寄信後，標記 claim 為 sent
 *   4. 前台使用者查詢自己的 claims 顯示狀態
 */
@Injectable()
export class RewardClaimService {
  constructor(
    @InjectRepository(RewardClaim)
    private readonly claimRepo: Repository<RewardClaim>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationMilestone)
    private readonly milestoneRepo: Repository<ReservationMilestone>,
  ) {}

  // ─── Admin: 批次建立發放紀錄 ────────────────────────────────────

  /**
   * 為某里程碑建立發放批次：
   *   - 抓出所有實際預約者
   *   - 找出尚未有此里程碑 claim 的預約者
   *   - 批次建立 pending claim
   *
   * 可重複執行（idempotent）：不會為同一對 (reservation, milestone) 重複建立
   */
  async distributeMilestone(
    milestoneId: string,
  ): Promise<{ created: number; skipped: number; totalReservations: number }> {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
    });
    if (!milestone) {
      throw new NotFoundException('里程碑不存在');
    }

    const reservations = await this.reservationRepo.find();
    const existingClaims = await this.claimRepo.find({
      where: { milestoneId },
      select: ['reservationId'],
    });
    const existingReservationIds = new Set(
      existingClaims.map((c) => c.reservationId),
    );

    const toCreate = reservations.filter(
      (r) => !existingReservationIds.has(r.id),
    );

    if (toCreate.length === 0) {
      return {
        created: 0,
        skipped: reservations.length,
        totalReservations: reservations.length,
      };
    }

    const claims = toCreate.map((r) =>
      this.claimRepo.create({
        reservationId: r.id,
        milestoneId,
        gameAccountSnapshot: r.gameAccountName,
        rewardNameSnapshot: milestone.rewardName,
        status: 'pending' as RewardClaimStatus,
      }),
    );

    await this.claimRepo.save(claims);

    return {
      created: toCreate.length,
      skipped: reservations.length - toCreate.length,
      totalReservations: reservations.length,
    };
  }

  // ─── Admin: 查詢發放狀況 ────────────────────────────────────────

  /**
   * 里程碑發放總覽：每個里程碑有多少 pending / sent / failed
   */
  async getDistributionSummary(): Promise<
    Array<{
      milestoneId: string;
      rewardName: string;
      threshold: number;
      pending: number;
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
      .getRawMany<{ milestoneId: string; status: RewardClaimStatus; count: string }>();

    const byMilestone = new Map<
      string,
      { pending: number; sent: number; failed: number }
    >();

    for (const row of rows) {
      const entry = byMilestone.get(row.milestoneId) ?? {
        pending: 0,
        sent: 0,
        failed: 0,
      };
      entry[row.status] = parseInt(row.count, 10);
      byMilestone.set(row.milestoneId, entry);
    }

    return milestones.map((m) => {
      const s = byMilestone.get(m.id) ?? { pending: 0, sent: 0, failed: 0 };
      return {
        milestoneId: m.id,
        rewardName: m.rewardName,
        threshold: m.threshold,
        pending: s.pending,
        sent: s.sent,
        failed: s.failed,
        total: s.pending + s.sent + s.failed,
      };
    });
  }

  /**
   * 查詢某里程碑底下的所有 claim 清單（含預約者基本資料）
   */
  async findClaimsByMilestone(
    milestoneId: string,
    status?: RewardClaimStatus,
    page = 1,
    limit = 50,
  ): Promise<{
    data: Array<RewardClaim & { websiteUserId?: string }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.claimRepo
      .createQueryBuilder('c')
      .leftJoin(Reservation, 'r', 'r.id = c.reservation_id')
      .addSelect('r.website_user_id', 'c_websiteUserId')
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

  // ─── Admin: 標記 claim 狀態 ─────────────────────────────────────

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
      // 狀態退回 pending / failed 時清掉 sent 資訊
      patch.sentAt = null;
      patch.sentBy = null;
    }

    const result = await this.claimRepo.update({ id: In(claimIds) }, patch);

    return { updated: result.affected ?? 0 };
  }

  // ─── Public: 使用者查自己的獎勵清單 ─────────────────────────────

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
}
