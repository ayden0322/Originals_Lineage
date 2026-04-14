import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { CommissionRecord } from '../entities/commission-record.entity';
import { Settlement } from '../entities/settlement.entity';
import { CommissionSettingsService } from './commission-settings.service';
import { getCurrentPeriod } from '../utils/period.util';

/**
 * 代理報表服務
 *
 * 隱私規則（詳見 分潤系統設計文件.md 第九章）：
 *  - 子代理明細不顯示「A 從 B 身上抽多少」給 B 看
 *  - 玩家 ID 預設遮罩（mask_player_id_for_agents 設定可開關）
 *  - B 看不到同級 B 的業績；A 可以看到自己旗下 B
 */
@Injectable()
export class AgentReportService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(CommissionRecord)
    private readonly recordRepo: Repository<CommissionRecord>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    private readonly settings: CommissionSettingsService,
  ) {}

  /** 本期預估分潤 + 業績 */
  async getCurrentPeriodSummary(agentId: string) {
    const settlementDay = await this.settings.get<number>('settlement_day', 5);
    const cur = getCurrentPeriod(new Date(), settlementDay);

    const records = await this.recordRepo
      .createQueryBuilder('r')
      .where('r.agent_id = :agentId', { agentId })
      .andWhere('r.paid_at >= :start', { start: cur.periodStart })
      .andWhere('r.paid_at < :end', { end: cur.periodEnd })
      .getMany();

    const myCommission = records.reduce(
      (s, r) => s + Number(r.commissionAmount),
      0,
    );
    const totalBase = records.reduce((s, r) => s + Number(r.baseAmount), 0);

    return {
      periodKey: cur.periodKey,
      periodStart: cur.periodStart,
      periodEnd: cur.periodEnd,
      transactionCount: records.length,
      totalBaseAmount: this.round(totalBase),
      myCommission: this.round(myCommission),
    };
  }

  /** 子代理業績明細（僅 A 可呼叫，且只回傳自己旗下的 B） */
  async getSubordinatesReport(agentId: string) {
    const me = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!me) throw new ForbiddenException();
    if (me.parentId) {
      // B 沒有下線
      return [];
    }

    const subs = await this.agentRepo.find({
      where: { parentId: agentId },
      order: { code: 'ASC' },
    });
    if (subs.length === 0) return [];

    const settlementDay = await this.settings.get<number>('settlement_day', 5);
    const cur = getCurrentPeriod(new Date(), settlementDay);

    // 本期內每個 B 的業績與分潤
    const subIds = subs.map((s) => s.id);
    const records = await this.recordRepo
      .createQueryBuilder('r')
      .where('r.agent_id IN (:...subIds)', { subIds })
      .andWhere('r.paid_at >= :start', { start: cur.periodStart })
      .andWhere('r.paid_at < :end', { end: cur.periodEnd })
      .getMany();

    // 按 agentId 分組
    const grouped = new Map<string, { base: number; commission: number; count: number }>();
    for (const r of records) {
      const cur = grouped.get(r.agentId) ?? { base: 0, commission: 0, count: 0 };
      cur.base += Number(r.baseAmount);
      cur.commission += Number(r.commissionAmount);
      cur.count += 1;
      grouped.set(r.agentId, cur);
    }

    return subs.map((s) => {
      const stat = grouped.get(s.id) ?? { base: 0, commission: 0, count: 0 };
      // ⚠️ 不回傳 A 從 B 抽到的金額（隱私規則）
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        status: s.status,
        bringInAmount: this.round(stat.base), // B 帶來的業績
        bSelfCommission: this.round(stat.commission), // B 自己分到多少
        transactionCount: stat.count,
      };
    });
  }

  /** 玩家消費明細（自己 + 旗下 B 的玩家） */
  async getPlayerTransactions(
    agentId: string,
    options: { from?: Date; to?: Date; limit?: number; offset?: number } = {},
  ) {
    const me = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!me) throw new ForbiddenException();

    // 範圍：自己 + 旗下 B
    const ids: string[] = [agentId];
    if (!me.parentId) {
      const subs = await this.agentRepo.find({ where: { parentId: agentId } });
      ids.push(...subs.map((s) => s.id));
    }

    const mask = await this.settings.get<boolean>('mask_player_id_for_agents', true);

    const qb = this.recordRepo
      .createQueryBuilder('r')
      .innerJoin('commission_player_attributions', 'pa', 'pa.agent_id = r.agent_id')
      .where('r.agent_id IN (:...ids)', { ids })
      .orderBy('r.paid_at', 'DESC');

    if (options.from) qb.andWhere('r.paid_at >= :from', { from: options.from });
    if (options.to) qb.andWhere('r.paid_at < :to', { to: options.to });

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    qb.limit(limit).offset(offset);

    const rows = await qb
      .select([
        'r.id AS id',
        'r.transaction_id AS transaction_id',
        'pa.player_id AS player_id',
        'r.base_amount AS base_amount',
        'r.commission_amount AS commission_amount',
        'r.paid_at AS paid_at',
        'r.agent_id AS agent_id',
      ])
      .getRawMany();

    return rows.map((row) => ({
      id: row.id,
      transactionId: row.transaction_id,
      playerId: mask ? this.maskPlayerId(row.player_id) : row.player_id,
      baseAmount: Number(row.base_amount),
      commissionAmount: Number(row.commission_amount),
      paidAt: row.paid_at,
      agentId: row.agent_id,
    }));
  }

  /** 結算 CSV 匯出（單期） */
  async exportSettlementCsv(agentId: string, settlementId: string): Promise<string> {
    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId, agentId },
    });
    if (!settlement) throw new ForbiddenException('結算不存在或無權查看');

    const records = await this.recordRepo.find({
      where: { settlementId },
      order: { paidAt: 'ASC' },
    });

    const mask = await this.settings.get<boolean>('mask_player_id_for_agents', true);

    const header = [
      '交易ID',
      '玩家ID',
      '儲值金額',
      '儲值時間',
      '你的分潤比例',
      '分潤金額',
      '歸屬層級',
      '結算期',
    ].join(',');

    // 取對應玩家 ID（透過 attribution 反查）
    const playerMap = new Map<string, string>();
    if (records.length > 0) {
      const txIds = records.map((r) => r.transactionId);
      const playerRows = await this.recordRepo.manager
        .createQueryBuilder()
        .select(['r.transaction_id AS tx', 'pa.player_id AS pid'])
        .from(CommissionRecord, 'r')
        .innerJoin('commission_player_attributions', 'pa', 'pa.agent_id = r.agent_id')
        .where('r.transaction_id IN (:...txIds)', { txIds })
        .andWhere('r.agent_id = :agentId', { agentId })
        .getRawMany();
      for (const p of playerRows) playerMap.set(p.tx, p.pid);
    }

    const lines = records.map((r) => {
      const pid = playerMap.get(r.transactionId) ?? '';
      return [
        r.transactionId,
        mask ? this.maskPlayerId(pid) : pid,
        r.baseAmount,
        r.paidAt instanceof Date ? r.paidAt.toISOString() : r.paidAt,
        Number(r.rateSnapshot),
        r.commissionAmount,
        r.level === 1 ? 'A' : 'B',
        r.periodKey,
      ].join(',');
    });

    return [header, ...lines].join('\n');
  }

  private maskPlayerId(playerId: string): string {
    if (!playerId || playerId.length < 4) return playerId;
    return `player_***${playerId.slice(-4)}`;
  }

  private round(v: number): number {
    return Math.round(v * 100) / 100;
  }
}
