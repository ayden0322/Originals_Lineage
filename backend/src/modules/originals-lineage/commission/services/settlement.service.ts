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
 * 當期預估：單一代理的待結分潤聚合
 */
export interface UnsettledPreviewAgentItem {
  periodKey: string;
  isCurrentPeriod: boolean;
  agentId: string;
  agentCode: string | null;
  agentName: string | null;
  agentLevel: 1 | 2;
  isSystem: boolean;
  transactionCount: number;
  totalBaseAmount: number;
  /** 純分潤（未扣加減項） */
  totalCommission: number;
  /** 當期 pending settlement 的加減項合計（含退款沖銷的負值、手動調整、補發等） */
  adjustmentTotal: number;
  /** 淨分潤 = totalCommission + adjustmentTotal */
  netCommission: number;
}

/**
 * 血盟儲值統計：單一血盟聚合
 */
export interface ClanStatItem {
  /** 血盟 id（snapshot at recharge）；null = 無血盟或查不到角色 */
  clanId: number | null;
  /** 血盟名稱（snapshot）；null 時 UI 顯示「無血盟」 */
  clanName: string | null;
  /** 該血盟這期原始儲值總額（未扣退款） */
  totalBaseAmount: number;
  /** 已退款的儲值金額（gross refunded base） */
  refundedBaseAmount: number;
  /** 淨儲值 = totalBaseAmount - refundedBaseAmount */
  netBaseAmount: number;
  /** 該期在此血盟儲值的獨立玩家數 */
  playerCount: number;
  /** 該期在此血盟的交易筆數（已 dedupe，不含同交易的 A/B 雙記錄） */
  transactionCount: number;
}

export interface ClanStatsResult {
  periodKey: string;
  availablePeriods: string[];
  summary: {
    totalClans: number;
    totalBaseAmount: number;
    totalRefundedBaseAmount: number;
    totalNetBaseAmount: number;
    totalPlayers: number;
    totalTransactions: number;
  };
  items: ClanStatItem[];
}

/**
 * 當期預估：全體聚合 + 每代理明細
 */
export interface UnsettledPreviewResult {
  settlementDay: number;
  currentPeriod: {
    periodKey: string;
    periodStart: Date;
    periodEnd: Date;
  };
  summary: {
    totalAgents: number;
    totalTransactions: number;
    totalBaseAmount: number;
    totalCommission: number;
    /** 所有當期 pending settlement 的加減項合計（退款/手動/補發） */
    totalAdjustment: number;
    /** 淨分潤 = totalCommission + totalAdjustment */
    totalNetCommission: number;
  };
  items: UnsettledPreviewAgentItem[];
}

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

  /**
   * 當期預估（尚未結算的分潤聚合，只讀不寫）
   *
   * 用途：管理者在結算日還沒到之前，想看看每個代理這期大概可以分多少。
   * 行為：
   *  - 撈所有 `commission_records WHERE settlement_id IS NULL`
   *  - 按 (period_key, agent_id) 分組加總
   *  - 依 period_key 是否等於「當前期」標記 isCurrentPeriod（其他視為前期殘留）
   *  - 不寫入任何資料，管理者可任意多次點擊
   */
  async getUnsettledPreview(): Promise<UnsettledPreviewResult> {
    const settlementDay = await this.settings.get<number>('settlement_day', 5);
    const cur = getCurrentPeriod(new Date(), settlementDay);

    const rows = await this.recordRepo
      .createQueryBuilder('r')
      .leftJoin('commission_agents', 'a', 'a.id = r.agent_id')
      .where('r.settlement_id IS NULL')
      .groupBy('r.period_key')
      .addGroupBy('r.agent_id')
      .addGroupBy('a.code')
      .addGroupBy('a.name')
      .addGroupBy('a.parent_id')
      .addGroupBy('a.is_system')
      .select([
        'r.period_key AS period_key',
        'r.agent_id AS agent_id',
        'a.code AS agent_code',
        'a.name AS agent_name',
        'a.parent_id AS parent_id',
        'a.is_system AS is_system',
        'COUNT(r.id) AS tx_count',
        'COALESCE(SUM(r.base_amount), 0) AS total_base',
        'COALESCE(SUM(r.commission_amount), 0) AS total_commission',
      ])
      .orderBy('r.period_key', 'DESC')
      .addOrderBy('total_commission', 'DESC')
      .getRawMany();

    // 當期所有 pending settlement 的加減項合計（退款沖銷 / 手動 / 補發）
    // - 只取 pending 狀態，避免把已 settled/paid 的結算重複計入「未結算預估」
    // - 只取當期 periodKey；前期殘留的 pending settlement 極少見，若存在也只在該 periodKey 的 row 上顯示
    const adjRows = await this.adjustmentRepo
      .createQueryBuilder('adj')
      .leftJoin('commission_settlements', 's', 's.id = adj.settlement_id')
      .where("s.status = 'pending'")
      .groupBy('s.period_key')
      .addGroupBy('s.agent_id')
      .select([
        's.period_key AS period_key',
        's.agent_id AS agent_id',
        'COALESCE(SUM(adj.amount), 0) AS total_adjustment',
      ])
      .getRawMany();

    const adjMap = new Map<string, number>();
    for (const ar of adjRows) {
      adjMap.set(`${ar.period_key}:${ar.agent_id}`, Number(ar.total_adjustment));
    }

    // 沒有分潤 record、只有 adjustment 的代理（例如：沖銷建立的空結算）也要列出來
    const recordKeySet = new Set(rows.map((r) => `${r.period_key}:${r.agent_id}`));
    const adjOnlyKeys = [...adjMap.keys()].filter((k) => !recordKeySet.has(k));

    let adjOnlyAgentInfo = new Map<
      string,
      { code: string | null; name: string | null; parentId: string | null; isSystem: boolean }
    >();
    if (adjOnlyKeys.length > 0) {
      const agentIds = Array.from(new Set(adjOnlyKeys.map((k) => k.split(':')[1])));
      const agents = await this.settlementRepo.manager
        .getRepository('commission_agents')
        .createQueryBuilder('a')
        .where('a.id IN (:...ids)', { ids: agentIds })
        .select(['a.id AS id', 'a.code AS code', 'a.name AS name', 'a.parent_id AS parent_id', 'a.is_system AS is_system'])
        .getRawMany();
      adjOnlyAgentInfo = new Map(
        agents.map((a) => [
          a.id as string,
          {
            code: a.code ?? null,
            name: a.name ?? null,
            parentId: a.parent_id ?? null,
            isSystem: !!a.is_system,
          },
        ]),
      );
    }

    const items: UnsettledPreviewAgentItem[] = rows.map((r) => {
      const adjustmentTotal = adjMap.get(`${r.period_key}:${r.agent_id}`) ?? 0;
      const totalCommission = Number(r.total_commission);
      return {
        periodKey: r.period_key,
        isCurrentPeriod: r.period_key === cur.periodKey,
        agentId: r.agent_id,
        agentCode: r.agent_code,
        agentName: r.agent_name,
        agentLevel: r.parent_id ? 2 : 1,
        isSystem: !!r.is_system,
        transactionCount: Number(r.tx_count),
        totalBaseAmount: Number(r.total_base),
        totalCommission,
        adjustmentTotal,
        netCommission: totalCommission + adjustmentTotal,
      };
    });

    // 補上「只有 adjustment、沒有對應 commission_records」的 rows
    for (const key of adjOnlyKeys) {
      const [periodKey, agentId] = key.split(':');
      const adjustmentTotal = adjMap.get(key) ?? 0;
      const info = adjOnlyAgentInfo.get(agentId);
      items.push({
        periodKey,
        isCurrentPeriod: periodKey === cur.periodKey,
        agentId,
        agentCode: info?.code ?? null,
        agentName: info?.name ?? null,
        agentLevel: info?.parentId ? 2 : 1,
        isSystem: info?.isSystem ?? false,
        transactionCount: 0,
        totalBaseAmount: 0,
        totalCommission: 0,
        adjustmentTotal,
        netCommission: adjustmentTotal,
      });
    }

    // 排序：periodKey DESC，同期內 netCommission DESC
    items.sort((a, b) => {
      if (a.periodKey !== b.periodKey) return a.periodKey < b.periodKey ? 1 : -1;
      return b.netCommission - a.netCommission;
    });

    const summary = items.reduce(
      (acc, it) => {
        acc.totalTransactions += it.transactionCount;
        acc.totalBaseAmount += it.totalBaseAmount;
        acc.totalCommission += it.totalCommission;
        acc.totalAdjustment += it.adjustmentTotal;
        return acc;
      },
      {
        totalAgents: 0,
        totalTransactions: 0,
        totalBaseAmount: 0,
        totalCommission: 0,
        totalAdjustment: 0,
        totalNetCommission: 0,
      },
    );
    summary.totalAgents = new Set(items.map((i) => i.agentId)).size;
    summary.totalBaseAmount = Math.round(summary.totalBaseAmount * 100) / 100;
    summary.totalCommission = Math.round(summary.totalCommission * 100) / 100;
    summary.totalAdjustment = Math.round(summary.totalAdjustment * 100) / 100;
    summary.totalNetCommission =
      Math.round((summary.totalCommission + summary.totalAdjustment) * 100) / 100;

    return {
      settlementDay,
      currentPeriod: {
        periodKey: cur.periodKey,
        periodStart: cur.periodStart,
        periodEnd: cur.periodEnd,
      },
      summary,
      items,
    };
  }

  /**
   * 血盟儲值統計（按 period 聚合）
   *
   * - clan_id / clan_name 是 commission_records 在儲值當下的 snapshot
   * - level=1 過濾避免 Case 1 的 A/B 兩筆記錄重複計入交易金額（兩筆 base_amount 相同）
   * - 退款沖銷比照 attribution.service 的 ref_adj LEFT JOIN 模式
   * - 無血盟（clan_id / clan_name 皆 NULL）會合併成一行，UI 顯示「無血盟」
   */
  async getClanStats(params: {
    periodKey?: string;
  } = {}): Promise<ClanStatsResult> {
    // 先取所有可選期別
    const periodRows = await this.recordRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.period_key', 'period_key')
      .orderBy('r.period_key', 'DESC')
      .getRawMany();
    const availablePeriods = periodRows.map((p) => p.period_key as string);

    // 無 period 指定時取最新的一期
    const periodKey =
      params.periodKey && availablePeriods.includes(params.periodKey)
        ? params.periodKey
        : (availablePeriods[0] ?? '');

    if (!periodKey) {
      return {
        periodKey: '',
        availablePeriods,
        summary: {
          totalClans: 0,
          totalBaseAmount: 0,
          totalRefundedBaseAmount: 0,
          totalNetBaseAmount: 0,
          totalPlayers: 0,
          totalTransactions: 0,
        },
        items: [],
      };
    }

    const rows = await this.recordRepo
      .createQueryBuilder('cr')
      // 退款沖銷：對齊該代理對該交易的 refund adjustment（per-agent unique）
      .leftJoin(
        'commission_settlement_adjustments',
        'ref_adj',
        `ref_adj.source_type = 'refund'
         AND ref_adj.source_transaction_id = cr.transaction_id
         AND EXISTS (
           SELECT 1 FROM commission_settlements s2
           WHERE s2.id = ref_adj.settlement_id AND s2.agent_id = cr.agent_id
         )`,
      )
      .where('cr.period_key = :periodKey', { periodKey })
      // level=1 避免 Case 1 同交易 A/B 雙記錄重複加總 base_amount
      .andWhere('cr.level = 1')
      .groupBy('cr.clan_id')
      .addGroupBy('cr.clan_name')
      .select([
        'cr.clan_id AS clan_id',
        'cr.clan_name AS clan_name',
        'COALESCE(SUM(cr.base_amount), 0) AS total_base',
        'COUNT(DISTINCT cr.player_id) AS player_count',
        'COUNT(cr.id) AS tx_count',
        `COALESCE(SUM(CASE WHEN ref_adj.id IS NOT NULL THEN cr.base_amount ELSE 0 END), 0) AS refunded_base`,
      ])
      .getRawMany();

    const items: ClanStatItem[] = rows.map((r) => {
      const totalBase = Number(r.total_base);
      const refundedBase = Number(r.refunded_base);
      return {
        clanId: r.clan_id === null || r.clan_id === undefined ? null : Number(r.clan_id),
        clanName: (r.clan_name as string | null) ?? null,
        totalBaseAmount: Math.round(totalBase * 100) / 100,
        refundedBaseAmount: Math.round(refundedBase * 100) / 100,
        netBaseAmount: Math.round((totalBase - refundedBase) * 100) / 100,
        playerCount: Number(r.player_count),
        transactionCount: Number(r.tx_count),
      };
    });

    // 排序：淨儲值 DESC；無血盟排最後
    items.sort((a, b) => {
      const aNull = a.clanId === null && a.clanName === null;
      const bNull = b.clanId === null && b.clanName === null;
      if (aNull !== bNull) return aNull ? 1 : -1;
      return b.netBaseAmount - a.netBaseAmount;
    });

    const summary = items.reduce(
      (acc, it) => {
        acc.totalBaseAmount += it.totalBaseAmount;
        acc.totalRefundedBaseAmount += it.refundedBaseAmount;
        acc.totalNetBaseAmount += it.netBaseAmount;
        acc.totalTransactions += it.transactionCount;
        return acc;
      },
      {
        totalClans: items.length,
        totalBaseAmount: 0,
        totalRefundedBaseAmount: 0,
        totalNetBaseAmount: 0,
        totalPlayers: 0,
        totalTransactions: 0,
      },
    );
    summary.totalBaseAmount = Math.round(summary.totalBaseAmount * 100) / 100;
    summary.totalRefundedBaseAmount =
      Math.round(summary.totalRefundedBaseAmount * 100) / 100;
    summary.totalNetBaseAmount =
      Math.round(summary.totalNetBaseAmount * 100) / 100;

    // 玩家數：跨血盟去重（同玩家在 A B 兩個血盟都儲值會被計為 1 人）
    const distinctPlayers = await this.recordRepo
      .createQueryBuilder('cr')
      .where('cr.period_key = :periodKey', { periodKey })
      .andWhere('cr.level = 1')
      .select('COUNT(DISTINCT cr.player_id)', 'cnt')
      .getRawOne();
    summary.totalPlayers = Number(distinctPlayers?.cnt ?? 0);

    return {
      periodKey,
      availablePeriods,
      summary,
      items,
    };
  }

  /** 列出代理的所有結算 */
  async listByAgent(agentId: string): Promise<Settlement[]> {
    return this.settlementRepo.find({
      where: { agentId },
      order: { periodStart: 'DESC' },
    });
  }

  /**
   * 取某代理在某期的訂單明細（含分潤記錄 + 加減項 + 可選期別）
   * 無論當期或歷史皆可用
   */
  async getAgentRecordsByPeriod(params: {
    agentId: string;
    periodKey: string;
  }): Promise<{
    periodKey: string;
    availablePeriods: string[];
    records: Array<{
      recordId: string;
      transactionId: string;
      playerId: string;
      playerAccount: string | null;
      level: 1 | 2;
      baseAmount: number;
      rateSnapshot: number;
      commissionAmount: number;
      paidAt: Date;
      periodKey: string;
      settlementId: string | null;
    }>;
    adjustments: Array<{
      id: string;
      amount: number;
      reason: string;
      sourceType: 'refund' | 'manual' | 'bonus';
      sourceTransactionId: string | null;
      createdAt: Date;
    }>;
    summary: {
      recordCount: number;
      totalBaseAmount: number;
      totalCommission: number;
      totalAdjustment: number;
      netCommission: number;
    };
  }> {
    const { agentId, periodKey } = params;

    // ① 分潤記錄 + join website_users 取玩家帳號
    const recordRows = await this.recordRepo
      .createQueryBuilder('r')
      .leftJoin('website_users', 'u', 'u.id = r.player_id')
      .where('r.agent_id = :agentId', { agentId })
      .andWhere('r.period_key = :periodKey', { periodKey })
      .select([
        'r.id AS record_id',
        'r.transaction_id AS transaction_id',
        'r.player_id AS player_id',
        'u.game_account_name AS player_account',
        'r.level AS level',
        'r.base_amount AS base_amount',
        'r.rate_snapshot AS rate_snapshot',
        'r.commission_amount AS commission_amount',
        'r.paid_at AS paid_at',
        'r.period_key AS period_key',
        'r.settlement_id AS settlement_id',
      ])
      .orderBy('r.paid_at', 'ASC')
      .getRawMany();

    const records = recordRows.map((r) => ({
      recordId: r.record_id as string,
      transactionId: r.transaction_id as string,
      playerId: r.player_id as string,
      playerAccount: (r.player_account as string | null) ?? null,
      level: (Number(r.level) === 2 ? 2 : 1) as 1 | 2,
      baseAmount: Number(r.base_amount),
      rateSnapshot: Number(r.rate_snapshot),
      commissionAmount: Number(r.commission_amount),
      paidAt: new Date(r.paid_at),
      periodKey: r.period_key as string,
      settlementId: (r.settlement_id as string | null) ?? null,
    }));

    // ② 加減項（退款沖銷 / 手動 / 補發）：透過 settlement 反查 agent + period
    const adjRows = await this.adjustmentRepo
      .createQueryBuilder('adj')
      .innerJoin('commission_settlements', 's', 's.id = adj.settlement_id')
      .where('s.agent_id = :agentId', { agentId })
      .andWhere('s.period_key = :periodKey', { periodKey })
      .orderBy('adj.created_at', 'ASC')
      .select([
        'adj.id AS id',
        'adj.amount AS amount',
        'adj.reason AS reason',
        'adj.source_type AS source_type',
        'adj.source_transaction_id AS source_transaction_id',
        'adj.created_at AS created_at',
      ])
      .getRawMany();

    const adjustments = adjRows.map((a) => ({
      id: a.id as string,
      amount: Number(a.amount),
      reason: a.reason as string,
      sourceType: a.source_type as 'refund' | 'manual' | 'bonus',
      sourceTransactionId: (a.source_transaction_id as string | null) ?? null,
      createdAt: new Date(a.created_at),
    }));

    // ③ 可選期別：該代理有 commission_records 或 settlements 紀錄的所有 periodKey
    const recordPeriods = await this.recordRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.period_key', 'period_key')
      .where('r.agent_id = :agentId', { agentId })
      .getRawMany();

    const settlementPeriods = await this.settlementRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.period_key', 'period_key')
      .where('s.agent_id = :agentId', { agentId })
      .getRawMany();

    const availablePeriods = Array.from(
      new Set<string>([
        ...recordPeriods.map((p) => p.period_key as string),
        ...settlementPeriods.map((p) => p.period_key as string),
      ]),
    ).sort((a, b) => (a < b ? 1 : -1));

    // ④ summary
    const totalBaseAmount =
      Math.round(records.reduce((s, r) => s + r.baseAmount, 0) * 100) / 100;
    const totalCommission =
      Math.round(records.reduce((s, r) => s + r.commissionAmount, 0) * 100) / 100;
    const totalAdjustment =
      Math.round(adjustments.reduce((s, a) => s + a.amount, 0) * 100) / 100;
    const netCommission =
      Math.round((totalCommission + totalAdjustment) * 100) / 100;

    return {
      periodKey,
      availablePeriods,
      records,
      adjustments,
      summary: {
        recordCount: records.length,
        totalBaseAmount,
        totalCommission,
        totalAdjustment,
        netCommission,
      },
    };
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
