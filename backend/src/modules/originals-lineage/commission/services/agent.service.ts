import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Agent } from '../entities/agent.entity';
import { AgentRate } from '../entities/agent-rate.entity';
import { ReferralLink } from '../entities/referral-link.entity';
import { AgentParentHistory } from '../entities/agent-parent-history.entity';
import { RateService } from './rate.service';

/**
 * 代理管理服務（總後台用）
 * - 新增 A / B 代理
 * - 停權前必須先轉移子代理
 * - B 轉掛父級（轉組）
 * - B 升格為一級代理（promote）
 * - 樹狀列表
 */
@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentRate)
    private readonly rateRepo: Repository<AgentRate>,
    @InjectRepository(ReferralLink)
    private readonly linkRepo: Repository<ReferralLink>,
    @InjectRepository(AgentParentHistory)
    private readonly parentHistoryRepo: Repository<AgentParentHistory>,
    private readonly rateService: RateService,
    private readonly dataSource: DataSource,
  ) {}

  /** 新增代理（A：parentId=null；B：parentId=A.id） */
  async create(params: {
    name: string;
    loginAccount: string;
    password: string;
    parentId?: string | null;
    rate: number;
    contactInfo?: Record<string, unknown> | null;
    selfReferralAllowed?: boolean;
    canSetSubRate?: boolean;
    operatorId?: string;
  }): Promise<Agent> {
    if (params.rate < 0 || params.rate > 1) {
      throw new BadRequestException('比例必須介於 0 ~ 1');
    }

    // 帳號唯一檢查
    const dupAccount = await this.agentRepo.findOne({
      where: { loginAccount: params.loginAccount },
    });
    if (dupAccount) throw new ConflictException('登入帳號已存在');

    // 父代理檢查（建立 B 時）
    if (params.parentId) {
      const parent = await this.agentRepo.findOne({ where: { id: params.parentId } });
      if (!parent) throw new NotFoundException('父代理不存在');
      if (parent.isSystem) throw new BadRequestException('不可掛在 SYSTEM 底下');
      if (parent.parentId) {
        throw new BadRequestException('父代理已是 B（二級），目前不支援三層代理');
      }
      if (parent.status !== 'active') {
        throw new BadRequestException('父代理已停權，不可新增子代理');
      }
    }

    return this.dataSource.transaction(async (trx) => {
      const agentRepo = trx.getRepository(Agent);
      const rateRepo = trx.getRepository(AgentRate);
      const linkRepo = trx.getRepository(ReferralLink);

      const code = await this.generateCode(params.parentId ? 'B' : 'A', trx);
      const passwordHash = await bcrypt.hash(params.password, 10);

      const agent = await agentRepo.save(
        agentRepo.create({
          parentId: params.parentId ?? null,
          code,
          name: params.name,
          loginAccount: params.loginAccount,
          passwordHash,
          contactInfo: params.contactInfo ?? null,
          status: 'active',
          selfReferralAllowed: params.selfReferralAllowed ?? false,
          canSetSubRate: params.canSetSubRate ?? false,
          isSystem: false,
        }),
      );

      // 初始 rate
      await rateRepo.save(
        rateRepo.create({
          agentId: agent.id,
          rate: params.rate,
          effectiveFrom: new Date(),
          effectiveTo: null,
          createdBy: params.operatorId ?? null,
        }),
      );

      // 預設推廣連結
      await linkRepo.save(
        linkRepo.create({
          agentId: agent.id,
          code: await this.generateLinkCode(trx),
          label: '預設連結',
          active: true,
        }),
      );

      return agent;
    });
  }

  /** 更新代理基本資料（不含 rate、不含 parentId） */
  async update(
    id: string,
    patch: {
      name?: string;
      contactInfo?: Record<string, unknown> | null;
      selfReferralAllowed?: boolean;
      canSetSubRate?: boolean;
    },
  ): Promise<Agent> {
    const agent = await this.findOneOrFail(id);
    if (agent.isSystem) throw new BadRequestException('SYSTEM 代理不可編輯');
    Object.assign(agent, patch);
    return this.agentRepo.save(agent);
  }

  /** 停權代理（檢查旗下是否還有 B） */
  async suspend(id: string): Promise<Agent> {
    const agent = await this.findOneOrFail(id);
    if (agent.isSystem) throw new BadRequestException('SYSTEM 代理不可停權');
    if (agent.status === 'suspended') return agent;

    if (!agent.parentId) {
      // 是 A → 檢查旗下是否還有 B
      const childCount = await this.agentRepo.count({ where: { parentId: id } });
      if (childCount > 0) {
        throw new BadRequestException(
          `代理 ${agent.code} 底下仍有 ${childCount} 個子代理，請先轉移再停權`,
        );
      }
    }

    agent.status = 'suspended';
    return this.agentRepo.save(agent);
  }

  /** 恢復代理 */
  async resume(id: string): Promise<Agent> {
    const agent = await this.findOneOrFail(id);
    if (agent.isSystem) throw new BadRequestException('SYSTEM 代理不可變更');
    agent.status = 'active';
    return this.agentRepo.save(agent);
  }

  /** B 轉掛父級（轉組） */
  async changeParent(
    id: string,
    newParentId: string,
    operatorId?: string,
    reason?: string,
  ): Promise<Agent> {
    const agent = await this.findOneOrFail(id);
    if (agent.isSystem) throw new BadRequestException('SYSTEM 不可變更');
    if (!agent.parentId) {
      throw new BadRequestException('一級代理（A）沒有父級可變更');
    }
    const newParent = await this.findOneOrFail(newParentId);
    if (newParent.isSystem) throw new BadRequestException('不可掛在 SYSTEM 底下');
    if (newParent.parentId) {
      throw new BadRequestException('新父代理已是 B，不支援多層');
    }
    if (newParent.status !== 'active') {
      throw new BadRequestException('新父代理已停權');
    }
    if (newParent.id === id) {
      throw new BadRequestException('不可掛在自己底下');
    }

    const fromParentId = agent.parentId;

    return this.dataSource.transaction(async (trx) => {
      const agentRepo = trx.getRepository(Agent);
      const parentHistRepo = trx.getRepository(AgentParentHistory);

      agent.parentId = newParentId;
      const saved = await agentRepo.save(agent);

      await parentHistRepo.save(
        parentHistRepo.create({
          agentId: id,
          fromParentId,
          toParentId: newParentId,
          action: 'change_parent',
          reason: reason ?? null,
          changedBy: operatorId ?? null,
        }),
      );

      return saved;
    });
  }

  /**
   * 將 B 升格為一級代理（A）
   *
   * 規則（詳見 分潤系統設計文件.md 第 8.5 章）：
   *  - 該代理必須是 B（有 parentId）且 active
   *  - 必須提供新 rate（原本「從 A 切下」的比例已不適用）
   *  - 旗下玩家歸屬不變、歷史 commission_records 不變
   *  - 寫入 agent_parent_history 留稽核軌跡（含舊/新 rate 快照）
   *  - 升格後自動沿用「A 代理」的所有規則：
   *      · 後續可由管理者新增子代理掛在它底下
   *      · 由 can_set_sub_rate 控制是否能自設子代理 rate
   */
  async promoteToLevel1(params: {
    agentId: string;
    newRate: number;
    operatorId?: string;
    reason?: string;
  }): Promise<Agent> {
    if (params.newRate < 0 || params.newRate > 1) {
      throw new BadRequestException('新比例必須介於 0 ~ 1');
    }
    if (!params.reason || params.reason.trim().length === 0) {
      throw new BadRequestException('升格必須填寫原因（稽核用）');
    }

    const agent = await this.findOneOrFail(params.agentId);
    if (agent.isSystem) throw new BadRequestException('SYSTEM 代理不可升格');
    if (!agent.parentId) {
      throw new BadRequestException('該代理已是一級代理（A），不需升格');
    }
    if (agent.status !== 'active') {
      throw new BadRequestException('已停權的代理不可升格，請先恢復');
    }

    const fromParentId = agent.parentId;
    const oldRate = await this.rateService.getCurrentRate(params.agentId);
    const now = new Date();

    return this.dataSource.transaction(async (trx) => {
      const agentRepo = trx.getRepository(Agent);
      const rateRepo = trx.getRepository(AgentRate);
      const parentHistRepo = trx.getRepository(AgentParentHistory);

      // 1. 升格：parent_id 設為 NULL
      agent.parentId = null;
      const saved = await agentRepo.save(agent);

      // 2. 關閉舊 rate，新增新 rate（時段快照）
      await rateRepo
        .createQueryBuilder()
        .update(AgentRate)
        .set({ effectiveTo: now })
        .where('agent_id = :agentId', { agentId: params.agentId })
        .andWhere('effective_to IS NULL')
        .execute();

      await rateRepo.save(
        rateRepo.create({
          agentId: params.agentId,
          rate: params.newRate,
          effectiveFrom: now,
          effectiveTo: null,
          createdBy: params.operatorId ?? null,
        }),
      );

      // 3. 寫稽核軌跡
      await parentHistRepo.save(
        parentHistRepo.create({
          agentId: params.agentId,
          fromParentId,
          toParentId: null,
          action: 'promote',
          oldRateSnapshot: oldRate,
          newRateSnapshot: params.newRate,
          reason: params.reason,
          changedBy: params.operatorId ?? null,
        }),
      );

      return saved;
    });
  }

  /** 取代理父級變更歷史（升格 + 轉組） */
  async getParentHistory(agentId: string): Promise<AgentParentHistory[]> {
    return this.parentHistoryRepo.find({
      where: { agentId },
      order: { changedAt: 'DESC' },
    });
  }

  /** 取得代理樹（兩層） */
  async getTree(): Promise<Array<Agent & { children: Agent[]; currentRate: number }>> {
    const all = await this.agentRepo.find({
      where: { isSystem: false },
      order: { code: 'ASC' },
    });

    const aList = all.filter((a) => !a.parentId);
    const bByParent = new Map<string, Agent[]>();
    for (const b of all.filter((a) => a.parentId)) {
      const arr = bByParent.get(b.parentId!) ?? [];
      arr.push(b);
      bByParent.set(b.parentId!, arr);
    }

    const result: Array<Agent & { children: Agent[]; currentRate: number }> = [];
    for (const a of aList) {
      const children = bByParent.get(a.id) ?? [];
      const aRate = await this.rateService.getCurrentRate(a.id);
      const enrichedChildren: Agent[] = [];
      for (const b of children) {
        enrichedChildren.push({
          ...b,
          currentRate: await this.rateService.getCurrentRate(b.id),
        } as Agent & { currentRate: number });
      }
      result.push({
        ...a,
        currentRate: aRate,
        children: enrichedChildren,
      } as Agent & { children: Agent[]; currentRate: number });
    }
    return result;
  }

  /** 管理員重設代理密碼（不需舊密碼） */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) {
      throw new BadRequestException('密碼至少 6 位');
    }
    const agent = await this.findOneOrFail(id);
    if (agent.isSystem) throw new BadRequestException('SYSTEM 代理不可變更密碼');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.agentRepo.update(id, { passwordHash: hash });
  }

  /** 代理自己改密碼（需驗舊密碼） */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) {
      throw new BadRequestException('新密碼至少 6 位');
    }
    // 因為 passwordHash 是 select: false，需要手動選取
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .addSelect('a.passwordHash')
      .where('a.id = :id', { id })
      .getOne();
    if (!agent) throw new NotFoundException('代理不存在');
    if (agent.isSystem) throw new BadRequestException('SYSTEM 代理不可變更密碼');

    const ok = await bcrypt.compare(oldPassword, agent.passwordHash);
    if (!ok) throw new BadRequestException('舊密碼錯誤');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.agentRepo.update(id, { passwordHash: hash });
  }

  async findOneOrFail(id: string): Promise<Agent> {
    const a = await this.agentRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('代理不存在');
    return a;
  }

  /**
   * 產生代理代碼 A001/B001
   * 改用 MAX(code) 取最大值 +1，避免 count 在併發或刪除後不準的問題。
   * 在 transaction 中執行，由外層 caller 保證已拿到 trx。
   */
  private async generateCode(prefix: 'A' | 'B', trx: EntityManager) {
    const result = await trx
      .getRepository(Agent)
      .createQueryBuilder('a')
      .select('MAX(a.code)', 'maxCode')
      .where('a.code LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('a.is_system = false')
      .getRawOne<{ maxCode: string | null }>();

    let nextNum = 1;
    if (result?.maxCode) {
      const numPart = parseInt(result.maxCode.replace(prefix, ''), 10);
      if (!isNaN(numPart)) nextNum = numPart + 1;
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  /** 產生隨機推廣連結短碼（6 碼大寫英數） */
  private async generateLinkCode(trx: EntityManager): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const repo = trx.getRepository(ReferralLink);
    for (let i = 0; i < 10; i++) {
      let code = '';
      for (let j = 0; j < 6; j++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const dup = await repo.findOne({ where: { code } });
      if (!dup) return code;
    }
    throw new Error('產生連結代碼失敗');
  }
}
