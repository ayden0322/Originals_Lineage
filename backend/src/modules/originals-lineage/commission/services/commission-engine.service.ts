import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Agent } from '../entities/agent.entity';
import { CommissionRecord } from '../entities/commission-record.entity';
import { RateService } from './rate.service';
import { AttributionService } from './attribution.service';
import { CommissionSettingsService } from './commission-settings.service';
import { getCurrentPeriod } from '../utils/period.util';
import { GameDbService } from '../../game-db/game-db.service';

/**
 * 儲值成功事件 payload（由外部儲值模組發出）
 * event name: 'commission.recharge.paid'
 */
export interface RechargePaidEvent {
  /** 交易 ID，對應 payment_transactions.id */
  transactionId: string;
  /** 玩家 ID，對應 website_users.id */
  playerId: string;
  /** 儲值金額（未扣任何成本） */
  amount: number;
  /** 交易完成時間（分潤歸期依據） */
  paidAt: Date;
}

/**
 * 分潤計算引擎
 *
 * 核心邏輯（2026-04 改版：加法模型 additive）：
 * - Case 1（玩家歸屬在 B）：
 *     teamPool = amount × rateA     （A 線總上限，rateA 設在 A 身上）
 *     B 拿     = amount × rateB     （B 直接抽 amount 的 rateB，不是抽 teamPool）
 *     A 拿     = teamPool − B 拿    （A 拿上限扣掉 B 後剩下的）
 *   約束：rateB ≤ rateA，否則 aCut 會變負數 → rate.service 的 setRate 會驗證擋下
 *        歷史 rate 不足時為了避免負值，這裡 clamp aCut = max(0, aCut)
 * - Case 2（玩家歸屬在 A）：A 拿 = amount × rateA
 * - Case 3（歸屬 SYSTEM 或上游停權）：寫一筆 amount=0 的紀錄，報表閉環用
 *
 * 舊版為乘法模型（bCut = teamPool × rateB），會導致「B 設 15% 實際只拿 4.5%」
 * 的不直覺行為，已廢棄。歷史紀錄靠 rate_snapshot / upstream_rate_snapshot 保護，
 * 結算只加總 commission_records 不重算，故改公式不影響已落地的紀錄。
 *
 * 所有 rate 均以 paidAt 時刻的快照為準，歷史紀錄永不重算。
 */
@Injectable()
export class CommissionEngineService {
  private readonly logger = new Logger(CommissionEngineService.name);

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(CommissionRecord)
    private readonly recordRepo: Repository<CommissionRecord>,
    private readonly rateService: RateService,
    private readonly attribution: AttributionService,
    private readonly settings: CommissionSettingsService,
    private readonly dataSource: DataSource,
    private readonly gameDb: GameDbService,
  ) {}

  /**
   * 取玩家儲值當下的血盟 snapshot
   * - 一帳號一角色，查不到或無血盟 → 皆回 null（血盟統計頁把 NULL 視為「無血盟」）
   * - 遊戲庫斷線時 gameDb 會優雅回空 Map，這裡也回 null，不阻斷分潤寫入
   */
  private async resolvePlayerClanSnapshot(
    playerId: string,
  ): Promise<{ clanId: number | null; clanName: string | null }> {
    try {
      const rows = (await this.dataSource.query(
        'SELECT game_account_name FROM website_users WHERE id = $1',
        [playerId],
      )) as Array<{ game_account_name: string | null }>;
      const accountName = rows[0]?.game_account_name ?? null;
      if (!accountName) return { clanId: null, clanName: null };

      const map = await this.gameDb.findCharacterClanByAccounts([accountName]);
      const hit = map.get(accountName);
      return {
        clanId: hit?.clanId ?? null,
        clanName: hit?.clanName ?? null,
      };
    } catch (err) {
      this.logger.warn(
        `血盟 snapshot 查詢失敗 player=${playerId}: ${(err as Error).message}`,
      );
      return { clanId: null, clanName: null };
    }
  }

  /**
   * 事件監聽入口：外部儲值模組完成交易後 emit 'commission.recharge.paid'
   * 此方法具備冪等性（同一 transactionId 重複觸發不會重複寫入）
   */
  @OnEvent('commission.recharge.paid')
  async onRechargePaid(event: RechargePaidEvent) {
    try {
      await this.generateCommissions(event);
    } catch (err) {
      // 事件監聯器不 re-throw：避免影響金流 callback 回覆導致金流平台重推
      // 錯誤只記 log，分潤缺漏可由管理者後台手動補登或重新觸發
      this.logger.error(
        `分潤計算失敗 tx=${event.transactionId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * 產生分潤紀錄（主入口）
   * - 冪等：若該交易已有紀錄直接 return
   * - 依歸屬判斷 A/B/SYSTEM 三種情境
   */
  async generateCommissions(event: RechargePaidEvent): Promise<void> {
    const exists = await this.recordRepo.count({
      where: { transactionId: event.transactionId },
    });
    if (exists > 0) {
      this.logger.warn(`交易 ${event.transactionId} 已有分潤紀錄，跳過`);
      return;
    }

    const attr = await this.attribution.getAttribution(event.playerId);
    const owner = await this.agentRepo.findOne({ where: { id: attr.agentId } });
    if (!owner) {
      this.logger.error(`歸屬代理不存在 agent=${attr.agentId}`);
      return;
    }

    // periodKey 以結算切點為準（而非單純月份），確保與 settlement 歸期一致
    const settlementDay = await this.settings.get<number>('settlement_day', 5);
    const periodKey = getCurrentPeriod(event.paidAt, settlementDay).periodKey;

    // 儲值當下血盟 snapshot（寫入後不再變動，血盟改名/換血盟都不影響歷史）
    const clanSnap = await this.resolvePlayerClanSnapshot(event.playerId);

    // ─── Case 3: 歸屬 SYSTEM（無歸屬） ─────────────────
    if (owner.isSystem) {
      await this.writeSystemRecord(event, owner.id, periodKey, clanSnap);
      return;
    }

    // 檢查自己或上游是否停權
    const ownerSuspended = owner.status !== 'active';
    let parent: Agent | null = null;
    if (owner.parentId) {
      parent = await this.agentRepo.findOne({ where: { id: owner.parentId } });
    }
    const parentSuspended = parent ? parent.status !== 'active' : false;

    if (ownerSuspended || parentSuspended) {
      const systemId = await this.attribution.getSystemAgentId();
      await this.writeSystemRecord(event, systemId, periodKey, clanSnap);
      return;
    }

    // ─── Case 1: 玩家歸屬在 B ─────────────────
    if (parent) {
      const rateA = await this.rateService.getEffectiveRate(parent.id, event.paidAt);
      const rateB = await this.rateService.getEffectiveRate(owner.id, event.paidAt);

      const teamPool = this.round(event.amount * rateA);
      const bCut = this.round(event.amount * rateB);
      const aCut = Math.max(0, this.round(teamPool - bCut));

      await this.dataSource.transaction(async (trx) => {
        const repo = trx.getRepository(CommissionRecord);
        await repo.insert([
          {
            transactionId: event.transactionId,
            agentId: owner.id,
            playerId: event.playerId,
            level: 2,
            baseAmount: event.amount,
            rateSnapshot: rateB,
            upstreamRateSnapshot: rateA,
            commissionAmount: bCut,
            periodKey,
            settlementId: null,
            paidAt: event.paidAt,
            clanId: clanSnap.clanId,
            clanName: clanSnap.clanName,
          },
          {
            transactionId: event.transactionId,
            agentId: parent.id,
            playerId: event.playerId,
            level: 1,
            baseAmount: event.amount,
            rateSnapshot: rateA,
            upstreamRateSnapshot: null,
            commissionAmount: aCut,
            periodKey,
            settlementId: null,
            paidAt: event.paidAt,
            clanId: clanSnap.clanId,
            clanName: clanSnap.clanName,
          },
        ]);
      });

      this.logger.log(
        `分潤 tx=${event.transactionId} amount=${event.amount} ` +
          `A=${parent.code}(${aCut}) B=${owner.code}(${bCut}) pool=${teamPool}`,
      );
      return;
    }

    // ─── Case 2: 玩家歸屬在 A（一級代理直推） ─────────────────
    const rateA = await this.rateService.getEffectiveRate(owner.id, event.paidAt);
    const aCut = this.round(event.amount * rateA);

    await this.recordRepo.insert({
      transactionId: event.transactionId,
      agentId: owner.id,
      playerId: event.playerId,
      level: 1,
      baseAmount: event.amount,
      rateSnapshot: rateA,
      upstreamRateSnapshot: null,
      commissionAmount: aCut,
      periodKey,
      settlementId: null,
      paidAt: event.paidAt,
      clanId: clanSnap.clanId,
      clanName: clanSnap.clanName,
    });

    this.logger.log(
      `分潤 tx=${event.transactionId} amount=${event.amount} A=${owner.code}(${aCut}) 直推`,
    );
  }

  /** 寫一筆 SYSTEM 紀錄（amount = 0），純為報表閉環 */
  private async writeSystemRecord(
    event: RechargePaidEvent,
    systemAgentId: string,
    periodKey: string,
    clanSnap: { clanId: number | null; clanName: string | null },
  ) {
    await this.recordRepo.insert({
      transactionId: event.transactionId,
      agentId: systemAgentId,
      playerId: event.playerId,
      level: 1,
      baseAmount: event.amount,
      rateSnapshot: 0,
      upstreamRateSnapshot: null,
      commissionAmount: 0,
      periodKey,
      settlementId: null,
      paidAt: event.paidAt,
      clanId: clanSnap.clanId,
      clanName: clanSnap.clanName,
    });
    this.logger.log(`分潤 tx=${event.transactionId} amount=${event.amount} → SYSTEM`);
  }

  /** 金額四捨五入到小數點兩位（金錢標準） */
  private round(v: number): number {
    return Math.round(v * 100) / 100;
  }
}
