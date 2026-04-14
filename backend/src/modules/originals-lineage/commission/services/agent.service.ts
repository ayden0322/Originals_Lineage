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
import { RateService } from './rate.service';

/**
 * 代理管理服務（總後台用）
 * - 新增 A / B 代理
 * - 停權前必須先轉移子代理
 * - B 轉掛父級
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

  /** B 轉掛父級 */
  async changeParent(id: string, newParentId: string): Promise<Agent> {
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

    agent.parentId = newParentId;
    return this.agentRepo.save(agent);
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

  async findOneOrFail(id: string): Promise<Agent> {
    const a = await this.agentRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('代理不存在');
    return a;
  }

  /** 產生代理代碼 A001/B001 */
  private async generateCode(prefix: 'A' | 'B', trx: EntityManager) {
    const repo = trx.getRepository(Agent);
    const count = await repo
      .createQueryBuilder('a')
      .where('a.code LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('a.is_system = false')
      .getCount();
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
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
