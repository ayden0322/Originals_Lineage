import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Agent } from '../entities/agent.entity';
import { CommissionRecord } from '../entities/commission-record.entity';
import { RateService } from './rate.service';
import { AttributionService } from './attribution.service';

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
 * 核心邏輯（詳見 分潤系統設計文件.md 第四章）：
 * - Case 1（玩家歸屬在 B）：teamPool = amount × rateA；B拿 = teamPool × rateB；A拿 = teamPool − B拿
 * - Case 2（玩家歸屬在 A）：A拿 = amount × rateA
 * - Case 3（歸屬 SYSTEM 或上游停權）：寫一筆 amount=0 的紀錄，報表閉環用
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
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 事件監聽入口：外部儲值模組完成交易後 emit 'commission.recharge.paid'
   * 此方法具備冪等性（同一 transactionId 重複觸發不會重複寫入）
   */
  @OnEvent('commission.recharge.paid')
  async onRechargePaid(event: RechargePaidEvent) {
    try {
      await this.generateCommissions(event);
    } catch (err) {
      this.logger.error(
        `分潤計算失敗 tx=${event.transactionId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
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

    const periodKey = this.formatPeriodKey(event.paidAt);

    // ─── Case 3: 歸屬 SYSTEM（無歸屬） ─────────────────
    if (owner.isSystem) {
      await this.writeSystemRecord(event, owner.id, periodKey);
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
      await this.writeSystemRecord(event, systemId, periodKey);
      return;
    }

    // ─── Case 1: 玩家歸屬在 B ─────────────────
    if (parent) {
      const rateA = await this.rateService.getEffectiveRate(parent.id, event.paidAt);
      const rateB = await this.rateService.getEffectiveRate(owner.id, event.paidAt);

      const teamPool = this.round(event.amount * rateA);
      const bCut = this.round(teamPool * rateB);
      const aCut = this.round(teamPool - bCut);

      await this.dataSource.transaction(async (trx) => {
        const repo = trx.getRepository(CommissionRecord);
        await repo.insert([
          {
            transactionId: event.transactionId,
            agentId: owner.id,
            level: 2,
            baseAmount: event.amount,
            rateSnapshot: rateB,
            upstreamRateSnapshot: rateA,
            commissionAmount: bCut,
            periodKey,
            settlementId: null,
            paidAt: event.paidAt,
          },
          {
            transactionId: event.transactionId,
            agentId: parent.id,
            level: 1,
            baseAmount: event.amount,
            rateSnapshot: rateA,
            upstreamRateSnapshot: null,
            commissionAmount: aCut,
            periodKey,
            settlementId: null,
            paidAt: event.paidAt,
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
      level: 1,
      baseAmount: event.amount,
      rateSnapshot: rateA,
      upstreamRateSnapshot: null,
      commissionAmount: aCut,
      periodKey,
      settlementId: null,
      paidAt: event.paidAt,
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
  ) {
    await this.recordRepo.insert({
      transactionId: event.transactionId,
      agentId: systemAgentId,
      level: 1,
      baseAmount: event.amount,
      rateSnapshot: 0,
      upstreamRateSnapshot: null,
      commissionAmount: 0,
      periodKey,
      settlementId: null,
      paidAt: event.paidAt,
    });
    this.logger.log(`分潤 tx=${event.transactionId} amount=${event.amount} → SYSTEM`);
  }

  /** 格式化期別 key：'YYYY-MM'（以 paidAt 的年月為準，實際結算歸期由結算排程決定） */
  private formatPeriodKey(paidAt: Date): string {
    const y = paidAt.getFullYear();
    const m = String(paidAt.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /** 金額四捨五入到小數點兩位（金錢標準） */
  private round(v: number): number {
    return Math.round(v * 100) / 100;
  }
}
