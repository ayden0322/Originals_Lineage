import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CommissionRecord } from '../entities/commission-record.entity';
import { Settlement } from '../entities/settlement.entity';
import { SettlementAdjustment } from '../entities/settlement-adjustment.entity';
import { CommissionSettingsService } from './commission-settings.service';
import { getCurrentPeriod, periodKeyOf } from '../utils/period.util';

/**
 * 結算服務
 *
 * 流程（詳見 分潤系統設計文件.md 第六章）：
 * 1. createForPeriod：根據 [periodStart, periodEnd) 把所有 commission_records 分組綁進 settlements
 * 2. addAdjustment：手動 / 退款沖銷 / 補發
 * 3. confirm：管理者確認結算
 * 4. markPaid：標記線下出款完成
 *
 * status 流：pending → settled → paid
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(CommissionRecord)
    private readonly recordRepo: Repository<CommissionRecord>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SettlementAdjustment)
    private readonly adjustmentRepo: Repository<SettlementAdjustment>,
    private readonly settings: CommissionSettingsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 為指定區間建立結算紀錄
   * - 撈出區間內所有未結算的 commission_records，按 agent_id 分組
   * - 為每個代理建立一筆 settlements
   * - 把 records.settlement_id 綁進對應 settlement
   * - 冪等：若該 (agent_id, period_key) 已存在就跳過該代理
   */
  async createForPeriod(params: {
    periodKey: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<Settlement[]> {
    const { periodKey, periodStart, periodEnd } = params;

    return this.dataSource.transaction(async (trx) => {
      const recordRepo = trx.getRepository(CommissionRecord);
      const settlementRepo = trx.getRepository(Settlement);

      const records = await recordRepo
        .createQueryBuilder('r')
        .where('r.settlement_id IS NULL')
        .andWhere('r.paid_at >= :start', { start: periodStart })
        .andWhere('r.paid_at < :end', { end: periodEnd })
        .getMany();

      // 按 agent_id 分組
      const grouped = new Map<string, CommissionRecord[]>();
      for (const r of records) {
        const arr = grouped.get(r.agentId) ?? [];
        arr.push(r);
        grouped.set(r.agentId, arr);
      }

      const created: Settlement[] = [];
      for (const [agentId, items] of grouped.entries()) {
        // 冪等檢查
        const existing = await settlementRepo.findOne({
          where: { agentId, periodKey },
        });
        if (existing) {
          this.logger.warn(`代理 ${agentId} 期 ${periodKey} 已有結算，跳過`);
          continue;
        }

        const total = items.reduce((sum, r) => sum + Number(r.commissionAmount), 0);
        const settlement = await settlementRepo.save(
          settlementRepo.create({
            agentId,
            periodKey,
            periodStart,
            periodEnd,
            totalCommission: total,
            totalAdjustment: 0,
            finalAmount: total,
            status: 'pending',
          }),
        );

        // 綁定 records 到此 settlement
        await trx
          .createQueryBuilder()
          .update(CommissionRecord)
          .set({ settlementId: settlement.id })
          .whereInIds(items.map((i) => i.id))
          .execute();

        created.push(settlement);
      }

      this.logger.log(`期 ${periodKey} 建立 ${created.length} 筆結算`);
      return created;
    });
  }

  /** 為指定 agent + period 取得或建立 pending 結算（給退款沖銷掛載用） */
  async getOrCreatePendingSettlement(params: {
    agentId: string;
    periodKey: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<Settlement> {
    const existing = await this.settlementRepo.findOne({
      where: { agentId: params.agentId, periodKey: params.periodKey },
    });
    if (existing) return existing;

    return this.settlementRepo.save(
      this.settlementRepo.create({
        agentId: params.agentId,
        periodKey: params.periodKey,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        totalCommission: 0,
        totalAdjustment: 0,
        finalAmount: 0,
        status: 'pending',
      }),
    );
  }

  /** 新增加減項並重算 settlement.final_amount */
  async addAdjustment(params: {
    settlementId: string;
    amount: number;
    reason: string;
    sourceType: 'refund' | 'manual' | 'bonus';
    sourceTransactionId?: string | null;
    operatorId?: string;
  }): Promise<SettlementAdjustment> {
    return this.dataSource.transaction(async (trx) => {
      const settlementRepo = trx.getRepository(Settlement);
      const adjRepo = trx.getRepository(SettlementAdjustment);

      const settlement = await settlementRepo.findOne({
        where: { id: params.settlementId },
      });
      if (!settlement) throw new NotFoundException('結算不存在');
      if (settlement.status === 'paid') {
        throw new BadRequestException('已出款的結算不可再加減項');
      }

      const adj = await adjRepo.save(
        adjRepo.create({
          settlementId: params.settlementId,
          amount: params.amount,
          reason: params.reason,
          sourceType: params.sourceType,
          sourceTransactionId: params.sourceTransactionId ?? null,
          createdBy: params.operatorId ?? null,
        }),
      );

      settlement.totalAdjustment = Number(settlement.totalAdjustment) + params.amount;
      settlement.finalAmount =
        Number(settlement.totalCommission) + Number(settlement.totalAdjustment);
      await settlementRepo.save(settlement);

      return adj;
    });
  }

  /** 管理者確認結算（pending → settled） */
  async confirm(settlementId: string, operatorId: string): Promise<Settlement> {
    const s = await this.settlementRepo.findOne({ where: { id: settlementId } });
    if (!s) throw new NotFoundException('結算不存在');
    if (s.status !== 'pending') {
      throw new BadRequestException(`狀態 ${s.status} 不可確認`);
    }
    s.status = 'settled';
    s.settledAt = new Date();
    s.settledBy = operatorId;
    return this.settlementRepo.save(s);
  }

  /** 標記已出款（settled → paid） */
  async markPaid(settlementId: string, operatorId: string): Promise<Settlement> {
    const s = await this.settlementRepo.findOne({ where: { id: settlementId } });
    if (!s) throw new NotFoundException('結算不存在');
    if (s.status !== 'settled') {
      throw new BadRequestException(`狀態 ${s.status} 不可標記出款`);
    }
    s.status = 'paid';
    s.paidAt = new Date();
    s.paidBy = operatorId;
    return this.settlementRepo.save(s);
  }

  /** 列出代理的所有結算 */
  async listByAgent(agentId: string): Promise<Settlement[]> {
    return this.settlementRepo.find({
      where: { agentId },
      order: { periodStart: 'DESC' },
    });
  }

  /** 取單期詳情 + 加減項 */
  async getDetail(settlementId: string): Promise<{
    settlement: Settlement;
    adjustments: SettlementAdjustment[];
    records: CommissionRecord[];
  }> {
    const settlement = await this.settlementRepo.findOne({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException('結算不存在');

    const [adjustments, records] = await Promise.all([
      this.adjustmentRepo.find({
        where: { settlementId },
        order: { createdAt: 'ASC' },
      }),
      this.recordRepo.find({
        where: { settlementId },
        order: { paidAt: 'ASC' },
      }),
    ]);
    return { settlement, adjustments, records };
  }
}
