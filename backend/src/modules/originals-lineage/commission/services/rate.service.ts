import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { AgentRate } from '../entities/agent-rate.entity';

/**
 * 代理分潤比例服務
 * - 查詢某時刻的有效比例（時段快照）
 * - 調整比例（即時生效，以新舊兩筆紀錄表達）
 */
@Injectable()
export class RateService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentRate)
    private readonly rateRepo: Repository<AgentRate>,
  ) {}

  /**
   * 查詢某代理在某時刻的有效比例
   * @returns 0~1 之間的比例數字（0.3 = 30%）；查無視為 0
   */
  async getEffectiveRate(agentId: string, at: Date): Promise<number> {
    const record = await this.rateRepo
      .createQueryBuilder('r')
      .where('r.agent_id = :agentId', { agentId })
      .andWhere('r.effective_from <= :at', { at })
      .andWhere('(r.effective_to IS NULL OR r.effective_to > :at)', { at })
      .getOne();

    return record ? Number(record.rate) : 0;
  }

  /** 查詢代理當前有效比例（便捷方法） */
  async getCurrentRate(agentId: string): Promise<number> {
    return this.getEffectiveRate(agentId, new Date());
  }

  /**
   * 設定/調整代理比例（即時生效）
   * - 關閉舊紀錄（effective_to = now）
   * - 新增新紀錄（effective_from = now, effective_to = NULL）
   * - 傳 0 也是合法的（代表暫時停止分潤給此人）
   */
  async setRate(params: {
    agentId: string;
    rate: number;
    operatorId?: string;
  }): Promise<AgentRate> {
    if (params.rate < 0 || params.rate > 1) {
      throw new BadRequestException('比例必須介於 0 ~ 1');
    }

    const agent = await this.agentRepo.findOne({ where: { id: params.agentId } });
    if (!agent) throw new NotFoundException('代理不存在');
    if (agent.isSystem) throw new BadRequestException('SYSTEM 虛擬代理不可設定比例');

    const now = new Date();

    // 關閉當前生效紀錄
    await this.rateRepo
      .createQueryBuilder()
      .update(AgentRate)
      .set({ effectiveTo: now })
      .where('agent_id = :agentId', { agentId: params.agentId })
      .andWhere('effective_to IS NULL')
      .execute();

    // 新增新紀錄
    const newRate = this.rateRepo.create({
      agentId: params.agentId,
      rate: params.rate,
      effectiveFrom: now,
      effectiveTo: null,
      createdBy: params.operatorId ?? null,
    });
    return this.rateRepo.save(newRate);
  }

  /** 取得代理的 rate 變更歷史（新到舊） */
  async getRateHistory(agentId: string): Promise<AgentRate[]> {
    return this.rateRepo.find({
      where: { agentId },
      order: { effectiveFrom: 'DESC' },
    });
  }
}
