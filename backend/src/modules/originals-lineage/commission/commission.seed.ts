import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { CommissionSetting } from './entities/commission-setting.entity';

/**
 * 分潤系統初始化種子
 * - 確保 SYSTEM 虛擬代理存在（用於承接無歸屬玩家）
 * - 確保預設系統設定存在
 */
@Injectable()
export class CommissionSeedService implements OnModuleInit {
  private readonly logger = new Logger(CommissionSeedService.name);

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(CommissionSetting)
    private readonly settingRepo: Repository<CommissionSetting>,
  ) {}

  async onModuleInit() {
    await this.ensureSystemAgent();
    await this.ensureDefaultSettings();
  }

  /** SYSTEM 虛擬代理：承接無歸屬玩家的儲值紀錄 */
  private async ensureSystemAgent() {
    const existing = await this.agentRepo.findOne({ where: { isSystem: true } });
    if (existing) return;

    const systemAgent = this.agentRepo.create({
      code: 'SYSTEM',
      name: '系統虛擬代理',
      loginAccount: '__system__',
      passwordHash: '__not_loginable__',
      status: 'active',
      selfReferralAllowed: false,
      canSetSubRate: false,
      isSystem: true,
    });
    await this.agentRepo.save(systemAgent);
    this.logger.log('已建立 SYSTEM 虛擬代理');
  }

  /** 預設系統設定 */
  private async ensureDefaultSettings() {
    const defaults: Array<{ key: string; value: unknown }> = [
      { key: 'settlement_day', value: 5 },
      { key: 'cookie_days', value: 30 },
      { key: 'mask_player_id_for_agents', value: true },
      { key: 'self_referral_default', value: false },
      { key: 'max_sub_rate', value: 1.0 },
    ];

    for (const item of defaults) {
      const existing = await this.settingRepo.findOne({ where: { key: item.key } });
      if (existing) continue;
      await this.settingRepo.save(this.settingRepo.create(item));
      this.logger.log(`已建立預設設定：${item.key}`);
    }
  }
}
