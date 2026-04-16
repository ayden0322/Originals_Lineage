import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { PlayerAttribution } from '../entities/player-attribution.entity';
import { PlayerAttributionHistory } from '../entities/player-attribution-history.entity';
import { ReferralLink } from '../entities/referral-link.entity';

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
  ) {}

  /** 取得 SYSTEM 虛擬代理 ID（快取可加在這） */
  async getSystemAgentId(): Promise<string> {
    const sys = await this.agentRepo.findOne({ where: { isSystem: true } });
    if (!sys) throw new Error('SYSTEM agent not seeded');
    return sys.id;
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
