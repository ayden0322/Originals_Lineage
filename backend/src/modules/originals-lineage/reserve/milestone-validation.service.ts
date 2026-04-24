import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import { ReservationPageSettings } from './entities/reservation-page-settings.entity';
import { GameDbService } from '../game-db/game-db.service';
import { REDIS_CLIENT } from '../../../core/database/redis.module';

export type ValidationIssueCode =
  | 'MILESTONE_NOT_FOUND'
  | 'MILESTONE_INACTIVE'
  | 'NO_ITEM_BOUND'
  | 'ITEM_NOT_IN_GAMEDB'
  | 'THRESHOLD_NOT_REACHED'
  | 'DEADLINE_NOT_REACHED'
  | 'GAME_DB_DOWN';

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  detail?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  milestone: ReservationMilestone | null;
  issues: ValidationIssue[];
  context: {
    actualReservationCount: number;
    displayCount: number;
    threshold: number | null;
    deadlineAt: Date | null;
    isDistributionLocked: boolean;
  };
}

/**
 * 發放前的守門服務：
 *   所有「能不能對 M 這個里程碑發獎」的前置條件集中在這裡，
 *   Controller / RewardClaimService 都透過本服務拿到標準化的 issues 陣列。
 *
 * 原則：只做讀取檢查，不做任何寫入；不拋例外（除非參數型別錯），以便前端
 * 可以在 modal 裡一次顯示所有問題。
 */
@Injectable()
export class MilestoneValidationService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationMilestone)
    private readonly milestoneRepo: Repository<ReservationMilestone>,
    @InjectRepository(ReservationPageSettings)
    private readonly pageSettingsRepo: Repository<ReservationPageSettings>,
    private readonly gameDbService: GameDbService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * 驗證某里程碑是否可發放：
   *   - milestone 存在且 isActive
   *   - 有綁定 game_item_id
   *   - 對應 etcitem 在遊戲 DB 找得到
   *   - displayCount ≥ threshold（達標）
   *   - 已過截止日 OR 已鎖定發放（避免活動未結束誤發）
   *   - 遊戲 DB 健檢通過
   */
  async validateCanDistribute(
    milestoneId: string,
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
    });
    const settings = await this.getPageSettings();
    const actualCount = await this.reservationRepo.count();
    const displayCount = (settings?.countBase ?? 0) + actualCount;

    const context = {
      actualReservationCount: actualCount,
      displayCount,
      threshold: milestone?.threshold ?? null,
      deadlineAt: settings?.deadlineAt ?? null,
      isDistributionLocked: settings?.isDistributionLocked ?? false,
    };

    if (!milestone) {
      issues.push({
        code: 'MILESTONE_NOT_FOUND',
        message: '里程碑不存在',
      });
      return { ok: false, milestone: null, issues, context };
    }

    if (!milestone.isActive) {
      issues.push({
        code: 'MILESTONE_INACTIVE',
        message: '里程碑已停用',
      });
    }

    if (!milestone.gameItemId) {
      issues.push({
        code: 'NO_ITEM_BOUND',
        message: '尚未綁定遊戲獎勵道具，請先到里程碑管理設定',
      });
    }

    if (displayCount < milestone.threshold) {
      issues.push({
        code: 'THRESHOLD_NOT_REACHED',
        message: `尚未達標（目前 ${displayCount} < 門檻 ${milestone.threshold}）`,
        detail: { displayCount, threshold: milestone.threshold },
      });
    }

    const deadlinePassed =
      settings?.deadlineAt && settings.deadlineAt.getTime() <= Date.now();
    if (!deadlinePassed && !settings?.isDistributionLocked) {
      issues.push({
        code: 'DEADLINE_NOT_REACHED',
        message: '活動尚未截止、也未手動鎖定，為避免誤發暫不開放發放',
        detail: {
          deadlineAt: settings?.deadlineAt ?? null,
          isDistributionLocked: settings?.isDistributionLocked ?? false,
        },
      });
    }

    // 遊戲 DB 健檢（與道具反查）只在上述條件通過時才做，避免浪費連線
    const hardIssueCount = issues.filter(
      (i) => i.code !== 'THRESHOLD_NOT_REACHED' && i.code !== 'DEADLINE_NOT_REACHED',
    ).length;
    if (hardIssueCount === 0 && milestone.gameItemId) {
      const healthy = await this.gameDbService.healthCheck();
      if (!healthy) {
        issues.push({
          code: 'GAME_DB_DOWN',
          message: '遊戲資料庫目前不可用，請檢查連線設定',
        });
      } else {
        const item = await this.gameDbService.findEtcItemById(
          milestone.gameItemId,
        );
        if (!item) {
          issues.push({
            code: 'ITEM_NOT_IN_GAMEDB',
            message: `綁定的道具 ID=${milestone.gameItemId} 在遊戲 etcitem 查不到`,
            detail: { gameItemId: milestone.gameItemId },
          });
        }
      }
    }

    return {
      ok: issues.length === 0,
      milestone,
      issues,
      context,
    };
  }

  /**
   * 列出「所有目前已達標且綁定道具」的里程碑 id，供「一鍵發放」使用。
   * 未達標、未綁道具、停用的都會被剔除。
   */
  async listReadyMilestoneIds(): Promise<string[]> {
    const [milestones, settings, actualCount] = await Promise.all([
      this.milestoneRepo.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC', threshold: 'ASC' },
      }),
      this.getPageSettings(),
      this.reservationRepo.count(),
    ]);

    const displayCount = (settings?.countBase ?? 0) + actualCount;
    return milestones
      .filter((m) => m.gameItemId != null && m.threshold <= displayCount)
      .map((m) => m.id);
  }

  private async getPageSettings(): Promise<ReservationPageSettings | null> {
    const list = await this.pageSettingsRepo.find({ take: 1 });
    return list[0] ?? null;
  }
}
