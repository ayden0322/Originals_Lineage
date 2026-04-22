import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { PlayerAttribution } from '../entities/player-attribution.entity';
import { PlayerAttributionHistory } from '../entities/player-attribution-history.entity';
import { ReferralLink } from '../entities/referral-link.entity';
import { GameDbService } from '../../game-db/game-db.service';

/**
 * 玩家歸屬服務
 * - 玩家註冊時首次綁定（不可覆蓋）
 * - 管理者可手動調整歸屬（留軌跡，歷史分潤不動）
 */
@Injectable()
export class AttributionService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(PlayerAttribution)
    private readonly attrRepo: Repository<PlayerAttribution>,
    @InjectRepository(PlayerAttributionHistory)
    private readonly historyRepo: Repository<PlayerAttributionHistory>,
    @InjectRepository(ReferralLink)
    private readonly linkRepo: Repository<ReferralLink>,
    private readonly dataSource: DataSource,
    private readonly gameDb: GameDbService,
  ) {}

  /** 取得 SYSTEM 虛擬代理 ID（快取可加在這） */
  async getSystemAgentId(): Promise<string> {
    const sys = await this.agentRepo.findOne({ where: { isSystem: true } });
    if (!sys) throw new Error('SYSTEM agent not seeded');
    return sys.id;
  }

  /**
   * 管理者：玩家歸屬總覽列表（含玩家帳號、代理、累積業績）
   *  - 可依 agentId、q（帳號/email）、時間範圍、linkedSource 過濾
   *  - 排除 SYSTEM 歸屬（預設），可用 includeSystem=true 打開
   */
  async listAttributions(options: {
    agentId?: string;
    q?: string;
    from?: Date;
    to?: Date;
    linkedSource?: 'cookie' | 'register' | 'manual' | 'system';
    includeSystem?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const qb = this.attrRepo
      .createQueryBuilder('pa')
      .leftJoin('commission_agents', 'a', 'a.id = pa.agent_id')
      .leftJoin('website_users', 'wu', 'wu.id = pa.player_id')
      .leftJoin(
        'commission_records',
        'cr',
        'cr.player_id = pa.player_id AND cr.agent_id = pa.agent_id',
      )
      // 對齊「該代理底下對該筆交易是否有退款沖銷」：
      //  - source_type='refund' + source_transaction_id = cr.transaction_id
      //  - 退款 adjustment 是 per-agent 的（跟 commission record 對齊），所以要確認 settlement 屬於同一代理
      //  - unique index 保證一個代理+交易最多 1 筆 refund adjustment，不會放大行數
      .leftJoin(
        'commission_settlement_adjustments',
        'ref_adj',
        `ref_adj.source_type = 'refund'
         AND ref_adj.source_transaction_id = cr.transaction_id
         AND EXISTS (
           SELECT 1 FROM commission_settlements s2
           WHERE s2.id = ref_adj.settlement_id AND s2.agent_id = cr.agent_id
         )`,
      );

    if (options.agentId) {
      qb.andWhere('pa.agent_id = :aid', { aid: options.agentId });
    }
    if (!options.includeSystem) {
      qb.andWhere('a.is_system = FALSE');
    }
    if (options.linkedSource) {
      qb.andWhere('pa.linked_source = :src', { src: options.linkedSource });
    }
    if (options.from) {
      qb.andWhere('pa.linked_at >= :from', { from: options.from });
    }
    if (options.to) {
      qb.andWhere('pa.linked_at < :to', { to: options.to });
    }
    if (options.q) {
      qb.andWhere(
        '(wu.game_account_name ILIKE :q OR wu.email ILIKE :q OR CAST(pa.player_id AS TEXT) = :qexact)',
        { q: `%${options.q}%`, qexact: options.q },
      );
    }

    qb.groupBy('pa.player_id')
      .addGroupBy('pa.agent_id')
      .addGroupBy('pa.linked_at')
      .addGroupBy('pa.linked_source')
      .addGroupBy('pa.link_id')
      .addGroupBy('a.id')
      .addGroupBy('a.code')
      .addGroupBy('a.name')
      .addGroupBy('a.is_system')
      .addGroupBy('a.parent_id')
      .addGroupBy('wu.game_account_name')
      .addGroupBy('wu.email')
      .orderBy('pa.linked_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .select([
        'pa.player_id AS player_id',
        'pa.agent_id AS agent_id',
        'pa.linked_at AS linked_at',
        'pa.linked_source AS linked_source',
        'pa.link_id AS link_id',
        'a.code AS agent_code',
        'a.name AS agent_name',
        'a.is_system AS agent_is_system',
        'a.parent_id AS agent_parent_id',
        'wu.game_account_name AS game_account_name',
        'wu.email AS email',
        'COALESCE(SUM(cr.base_amount), 0) AS total_recharge',
        'COALESCE(SUM(cr.commission_amount), 0) AS total_commission',
        'COUNT(cr.id) AS tx_count',
        'MAX(cr.paid_at) AS last_paid_at',
        // 已退款聚合：ref_adj 存在 = 該 cr 已被沖銷
        'COALESCE(SUM(CASE WHEN ref_adj.id IS NOT NULL THEN cr.base_amount ELSE 0 END), 0) AS refunded_base',
        'COALESCE(SUM(CASE WHEN ref_adj.id IS NOT NULL THEN cr.commission_amount ELSE 0 END), 0) AS refunded_commission',
        'COUNT(DISTINCT CASE WHEN ref_adj.id IS NOT NULL THEN cr.id END) AS refunded_tx_count',
      ]);

    const rows = await qb.getRawMany();

    // 批次查該頁玩家的遊戲角色 + 血盟（一帳號一角色）
    const accountNames = rows
      .map((r) => r.game_account_name)
      .filter((v): v is string => !!v);
    const charClanMap = await this.gameDb.findCharacterClanByAccounts(
      Array.from(new Set(accountNames)),
    );

    return rows.map((row) => {
      const totalRecharge = Number(row.total_recharge);
      const totalCommission = Number(row.total_commission);
      const refundedBase = Number(row.refunded_base);
      const refundedCommission = Number(row.refunded_commission);
      const charClan = row.game_account_name
        ? charClanMap.get(row.game_account_name)
        : undefined;
      return {
        playerId: row.player_id,
        gameAccountName: row.game_account_name ?? null,
        email: row.email ?? null,
        charName: charClan?.charName ?? null,
        clanName: charClan?.clanName ?? null,
        agentId: row.agent_id,
        agentCode: row.agent_code,
        agentName: row.agent_name,
        agentIsSystem: !!row.agent_is_system,
        agentLevel: row.agent_parent_id ? 2 : 1,
        linkedAt: row.linked_at,
        linkedSource: row.linked_source as 'cookie' | 'register' | 'manual' | 'system',
        linkId: row.link_id,
        totalRecharge,
        totalCommission,
        transactionCount: Number(row.tx_count),
        lastPaidAt: row.last_paid_at,
        // 退款相關：原始 - 已退 = 淨額
        refundedBaseAmount: refundedBase,
        refundedCommission,
        refundedTxCount: Number(row.refunded_tx_count),
        netRecharge: totalRecharge - refundedBase,
        netCommission: totalCommission - refundedCommission,
      };
    });
  }

  /**
   * 單筆查詢：歸屬 + 遊戲帳號 / 角色 / 血盟（供管理者 UI 顯示）
   * - 歷史分潤計算仍走 getAttribution（純 entity）以免影響引擎
   */
  async getAttributionDetail(playerId: string) {
    const attr = await this.getAttribution(playerId);
    const row = await this.dataSource.query(
      'SELECT game_account_name FROM website_users WHERE id = $1',
      [playerId],
    );
    const gameAccountName: string | null =
      (row as Array<{ game_account_name: string | null }>)[0]
        ?.game_account_name ?? null;

    let charName: string | null = null;
    let clanName: string | null = null;
    if (gameAccountName) {
      const map = await this.gameDb.findCharacterClanByAccounts([
        gameAccountName,
      ]);
      const hit = map.get(gameAccountName);
      charName = hit?.charName ?? null;
      clanName = hit?.clanName ?? null;
    }

    return {
      playerId: attr.playerId,
      agentId: attr.agentId,
      linkId: attr.linkId,
      linkedSource: attr.linkedSource,
      linkedAt: attr.linkedAt,
      updatedAt: attr.updatedAt,
      gameAccountName,
      charName,
      clanName,
    };
  }

  /**
   * 玩家交易 / 分潤紀錄（供明細頁）
   * - GROUP BY transaction_id：一筆儲值一列，A/B 分潤並排
   * - 結算週期 = 日曆月，period_key = 'YYYY-MM'
   * - 同步回傳區間聚合（summary），避免前端再打一次
   */
  async listPlayerTransactions(
    playerId: string,
    options: { from?: Date; to?: Date; limit?: number; offset?: number } = {},
  ) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // 建動態 WHERE（注意：rowsSql 末尾還要附加 limit/offset，所以參數編號要留著）
    const whereParts = ['cr.player_id = $1'];
    const whereParams: unknown[] = [playerId];
    if (options.from) {
      whereParts.push(`cr.paid_at >= $${whereParams.length + 1}`);
      whereParams.push(options.from);
    }
    if (options.to) {
      whereParts.push(`cr.paid_at < $${whereParams.length + 1}`);
      whereParams.push(options.to);
    }
    const whereSql = whereParts.join(' AND ');

    // 每筆 cr 對齊該代理的退款 adjustment（若存在 = 該 cr 已被沖銷）
    const refAdjJoin = `
      LEFT JOIN commission_settlement_adjustments ref_adj
        ON ref_adj.source_type = 'refund'
       AND ref_adj.source_transaction_id = cr.transaction_id
       AND EXISTS (
         SELECT 1 FROM commission_settlements s2
         WHERE s2.id = ref_adj.settlement_id AND s2.agent_id = cr.agent_id
       )`;

    // rowsSql 在 whereParams 之後再加 limit / offset
    const rowsSql = `
      SELECT
        cr.transaction_id AS transaction_id,
        MAX(cr.paid_at) AS paid_at,
        MAX(cr.base_amount) AS base_amount,
        MAX(cr.period_key) AS period_key,
        BOOL_OR(cr.settlement_id IS NOT NULL) AS settled,
        BOOL_OR(ref_adj.id IS NOT NULL) AS refunded,
        MAX(CASE WHEN cr.level = 1 THEN cr.commission_amount END) AS a_commission,
        MAX(CASE WHEN cr.level = 2 THEN cr.commission_amount END) AS b_commission,
        MAX(CASE WHEN cr.level = 1 THEN cr.rate_snapshot END) AS a_rate,
        MAX(CASE WHEN cr.level = 2 THEN cr.rate_snapshot END) AS b_rate,
        MAX(CASE WHEN cr.level = 1 THEN a.code END) AS a_code,
        MAX(CASE WHEN cr.level = 1 THEN a.name END) AS a_name,
        MAX(CASE WHEN cr.level = 2 THEN a.code END) AS b_code,
        MAX(CASE WHEN cr.level = 2 THEN a.name END) AS b_name
      FROM commission_records cr
      LEFT JOIN commission_agents a ON a.id = cr.agent_id
      ${refAdjJoin}
      WHERE ${whereSql}
      GROUP BY cr.transaction_id
      ORDER BY MAX(cr.paid_at) DESC
      LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}
    `;
    const rowsParams = [...whereParams, limit, offset];

    const summarySql = `
      WITH per_tx AS (
        SELECT
          cr.transaction_id,
          MAX(cr.base_amount) AS base_amount,
          SUM(cr.commission_amount) AS commission_sum,
          BOOL_OR(ref_adj.id IS NOT NULL) AS refunded
        FROM commission_records cr
        ${refAdjJoin}
        WHERE ${whereSql}
        GROUP BY cr.transaction_id
      )
      SELECT
        COUNT(*)::int AS tx_count,
        COUNT(*) FILTER (WHERE refunded)::int AS refunded_tx_count,
        COALESCE(SUM(base_amount), 0) AS total_recharge,
        COALESCE(SUM(CASE WHEN refunded THEN base_amount ELSE 0 END), 0) AS refunded_recharge,
        COALESCE(SUM(commission_sum), 0) AS total_commission,
        COALESCE(SUM(CASE WHEN refunded THEN commission_sum ELSE 0 END), 0) AS refunded_commission
      FROM per_tx
    `;

    const [rows, summaryRows] = await Promise.all([
      this.dataSource.query(rowsSql, rowsParams),
      this.dataSource.query(summarySql, whereParams),
    ]);

    const items = (rows as Array<Record<string, unknown>>).map((r) => {
      const aCommission = r.a_commission != null ? Number(r.a_commission) : 0;
      const bCommission = r.b_commission != null ? Number(r.b_commission) : 0;
      return {
        transactionId: String(r.transaction_id),
        paidAt: r.paid_at as Date,
        baseAmount: Number(r.base_amount),
        periodKey: String(r.period_key),
        settled: !!r.settled,
        refunded: !!r.refunded,
        aCode: (r.a_code as string) ?? null,
        aName: (r.a_name as string) ?? null,
        aRate: r.a_rate != null ? Number(r.a_rate) : null,
        aCommission,
        bCode: (r.b_code as string) ?? null,
        bName: (r.b_name as string) ?? null,
        bRate: r.b_rate != null ? Number(r.b_rate) : null,
        bCommission,
        totalCommission: aCommission + bCommission,
      };
    });

    const s = (summaryRows as Array<Record<string, unknown>>)[0] ?? {};
    const totalRecharge = Number(s.total_recharge ?? 0);
    const refundedRecharge = Number(s.refunded_recharge ?? 0);
    const totalCommission = Number(s.total_commission ?? 0);
    const refundedCommission = Number(s.refunded_commission ?? 0);

    return {
      items,
      summary: {
        txCount: Number(s.tx_count ?? 0),
        refundedTxCount: Number(s.refunded_tx_count ?? 0),
        totalRecharge,
        refundedRecharge,
        netRecharge: totalRecharge - refundedRecharge,
        totalCommission,
        refundedCommission,
        netCommission: totalCommission - refundedCommission,
      },
    };
  }

  /** 查詢玩家歸屬；查無則歸 SYSTEM */
  async getAttribution(playerId: string): Promise<PlayerAttribution> {
    const existing = await this.attrRepo.findOne({ where: { playerId } });
    if (existing) return existing;

    // 沒有歸屬 → 寫入 SYSTEM（用 ON CONFLICT DO NOTHING 防併發）
    const systemId = await this.getSystemAgentId();
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(PlayerAttribution)
      .values({
        playerId,
        agentId: systemId,
        linkId: null,
        linkedSource: 'system',
      })
      .orIgnore()  // INSERT ... ON CONFLICT DO NOTHING
      .execute();

    // 重新查一次（可能是併發先寫的那筆，也可能是我們剛寫的）
    return this.attrRepo.findOneOrFail({ where: { playerId } });
  }

  /**
   * 玩家註冊完成時呼叫，依 refCode 綁定歸屬
   * - 若已綁定則不覆蓋（終身綁定）
   * - 若 refCode 無效、連結停用、或對應代理已停權 → 歸 SYSTEM
   */
  async attributeOnRegister(params: {
    playerId: string;
    refCode?: string | null;
    source?: 'cookie' | 'register';
  }): Promise<PlayerAttribution> {
    const existing = await this.attrRepo.findOne({ where: { playerId: params.playerId } });
    if (existing) return existing;

    const systemId = await this.getSystemAgentId();
    let agentId = systemId;
    let linkId: string | null = null;
    let source: 'cookie' | 'register' | 'manual' | 'system' = 'system';

    if (params.refCode) {
      const link = await this.linkRepo.findOne({
        where: { code: params.refCode, active: true },
      });
      if (link) {
        const agent = await this.agentRepo.findOne({ where: { id: link.agentId } });
        if (agent && agent.status === 'active' && !agent.isSystem) {
          // 若是 B，需順便檢查其 A 是否停權
          if (agent.parentId) {
            const parent = await this.agentRepo.findOne({ where: { id: agent.parentId } });
            if (!parent || parent.status !== 'active') {
              // 上游停權 → 歸 SYSTEM
            } else {
              agentId = agent.id;
              linkId = link.id;
              source = params.source ?? 'cookie';
            }
          } else {
            agentId = agent.id;
            linkId = link.id;
            source = params.source ?? 'cookie';
          }
        }
      }
    }

    // 用 ON CONFLICT DO NOTHING 防併發：若其他 request 已搶先寫入就不覆蓋
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(PlayerAttribution)
      .values({
        playerId: params.playerId,
        agentId,
        linkId,
        linkedSource: source,
      })
      .orIgnore()
      .execute();

    return this.attrRepo.findOneOrFail({ where: { playerId: params.playerId } });
  }

  /**
   * 管理者手動調整玩家歸屬
   * - 歷史 commission_records 不動
   * - 寫一筆 history 留軌跡
   */
  async changeAttribution(params: {
    playerId: string;
    toAgentId: string;
    operatorId?: string;
    reason?: string;
  }): Promise<PlayerAttribution> {
    const target = await this.agentRepo.findOne({ where: { id: params.toAgentId } });
    if (!target) throw new NotFoundException('目標代理不存在');

    return this.dataSource.transaction(async (trx) => {
      const attrRepo = trx.getRepository(PlayerAttribution);
      const histRepo = trx.getRepository(PlayerAttributionHistory);

      const current = await attrRepo.findOne({ where: { playerId: params.playerId } });
      const fromAgentId = current?.agentId ?? null;

      let saved: PlayerAttribution;
      if (current) {
        current.agentId = params.toAgentId;
        current.linkedSource = 'manual';
        current.linkId = null;
        saved = await attrRepo.save(current);
      } else {
        saved = await attrRepo.save(
          attrRepo.create({
            playerId: params.playerId,
            agentId: params.toAgentId,
            linkId: null,
            linkedSource: 'manual',
          }),
        );
      }

      await histRepo.save(
        histRepo.create({
          playerId: params.playerId,
          fromAgentId,
          toAgentId: params.toAgentId,
          changedBy: params.operatorId ?? null,
          reason: params.reason ?? null,
        }),
      );

      return saved;
    });
  }
}
