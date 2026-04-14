import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { Agent } from './entities/agent.entity';
import { AgentRate } from './entities/agent-rate.entity';
import { ReferralLink } from './entities/referral-link.entity';
import { PlayerAttribution } from './entities/player-attribution.entity';
import { PlayerAttributionHistory } from './entities/player-attribution-history.entity';
import { CommissionRecord } from './entities/commission-record.entity';
import { Settlement } from './entities/settlement.entity';
import { SettlementAdjustment } from './entities/settlement-adjustment.entity';
import { CommissionSetting } from './entities/commission-setting.entity';
import { CommissionSettingHistory } from './entities/commission-setting-history.entity';
import { AgentParentHistory } from './entities/agent-parent-history.entity';
import { CommissionSeedService } from './commission.seed';
import { RateService } from './services/rate.service';
import { AttributionService } from './services/attribution.service';
import { CommissionEngineService } from './services/commission-engine.service';
import { CommissionSettingsService } from './services/commission-settings.service';
import { SettlementService } from './services/settlement.service';
import { RefundService } from './services/refund.service';
import { SettlementSchedulerService } from './services/settlement-scheduler.service';
import { AgentService } from './services/agent.service';
import { ReferralLinkService } from './services/referral-link.service';
import { AgentAuthService } from './services/agent-auth.service';
import { AgentReportService } from './services/agent-report.service';
import { AdminCommissionController } from './commission.controller';
import { AgentSelfController } from './agent-self.controller';
import { PublicReferralController } from './public-referral.controller';

/**
 * 代理分潤系統模組
 * 詳細設計請見：分潤系統設計文件.md（專案根目錄）
 *
 * 已完成：
 *  - Entities + Migration（synchronize 自動建表）
 *  - 分潤計算引擎（commission.recharge.paid 事件）
 *  - 結算排程（每日 00:00）+ 退款沖銷
 *  - 總後台 API（24 endpoints）
 *  - 代理後台 API + 公開推廣連結追蹤
 *
 * 後續步驟：前端 admin + agent 介面
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      AgentRate,
      ReferralLink,
      PlayerAttribution,
      PlayerAttributionHistory,
      CommissionRecord,
      Settlement,
      SettlementAdjustment,
      CommissionSetting,
      CommissionSettingHistory,
      AgentParentHistory,
    ]),
    ScheduleModule.forRoot(),
    JwtModule.register({}),
  ],
  controllers: [
    AdminCommissionController,
    AgentSelfController,
    PublicReferralController,
  ],
  providers: [
    CommissionSeedService,
    CommissionSettingsService,
    RateService,
    AttributionService,
    CommissionEngineService,
    SettlementService,
    RefundService,
    SettlementSchedulerService,
    AgentService,
    ReferralLinkService,
    AgentAuthService,
    AgentReportService,
  ],
  exports: [
    TypeOrmModule,
    CommissionSettingsService,
    RateService,
    AttributionService,
    CommissionEngineService,
    SettlementService,
    RefundService,
    AgentService,
    ReferralLinkService,
  ],
})
export class CommissionModule {}
