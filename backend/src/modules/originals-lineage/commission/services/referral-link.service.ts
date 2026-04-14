import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralLink } from '../entities/referral-link.entity';

/**
 * 推廣連結服務
 * - 一個代理可有多組連結（不同活動）
 * - 停用後新玩家掃 QR 不會綁定（視為無歸屬）
 */
@Injectable()
export class ReferralLinkService {
  constructor(
    @InjectRepository(ReferralLink)
    private readonly linkRepo: Repository<ReferralLink>,
  ) {}

  async create(params: { agentId: string; label?: string }): Promise<ReferralLink> {
    return this.linkRepo.save(
      this.linkRepo.create({
        agentId: params.agentId,
        code: await this.generateCode(),
        label: params.label ?? null,
        active: true,
      }),
    );
  }

  async listByAgent(agentId: string): Promise<ReferralLink[]> {
    return this.linkRepo.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    });
  }

  async toggleActive(id: string, active: boolean): Promise<ReferralLink> {
    const link = await this.linkRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('推廣連結不存在');
    link.active = active;
    return this.linkRepo.save(link);
  }

  async findByCode(code: string): Promise<ReferralLink | null> {
    return this.linkRepo.findOne({ where: { code } });
  }

  private async generateCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 10; i++) {
      let code = '';
      for (let j = 0; j < 6; j++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const dup = await this.linkRepo.findOne({ where: { code } });
      if (!dup) return code;
    }
    throw new Error('產生連結代碼失敗');
  }
}
