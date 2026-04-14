import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettlementService } from './settlement.service';
import { CommissionSettingsService } from './commission-settings.service';
import {
  getPreviousPeriod,
  isSettlementDayToday,
} from '../utils/period.util';

/**
 * 結算排程
 *
 * 每天 00:00 跑一次：
 *  1. 讀取當前 settlement_day 設定
 *  2. 檢查今天是否為結算日（含月底邊界：settlement_day > 當月天數時抓最後一天）
 *  3. 是 → 計算上一期範圍，呼叫 SettlementService.createForPeriod
 *
 * 結算日中途變更採「預約下期生效」，由 CommissionSettingsService.getSettlementDayForPeriod 處理。
 */
@Injectable()
export class SettlementSchedulerService {
  private readonly logger = new Logger(SettlementSchedulerService.name);

  constructor(
    private readonly settlementService: SettlementService,
    private readonly settings: CommissionSettingsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCheck() {
    const now = new Date();
    const currentSettlementDay = await this.settings.get<number>('settlement_day', 5);

    if (!isSettlementDayToday(now, currentSettlementDay)) {
      return;
    }

    this.logger.log(`今天是結算日（day=${currentSettlementDay}），開始結算上一期`);

    // 計算上一期範圍
    const prev = getPreviousPeriod(now, currentSettlementDay);

    // 上一期可能適用不同的 settlement_day（若曾預約變更）→ 重新查
    const periodSettlementDay = await this.settings.getSettlementDayForPeriod(
      prev.periodKey,
    );
    if (periodSettlementDay !== currentSettlementDay) {
      // 若上一期應該用舊值切，重新計算範圍
      const recalc = getPreviousPeriod(now, periodSettlementDay);
      this.logger.log(
        `上一期 ${prev.periodKey} 適用舊 settlement_day=${periodSettlementDay}，重算範圍`,
      );
      await this.runSettlement(recalc);
      return;
    }

    await this.runSettlement(prev);
  }

  /** 手動觸發（測試 / 補跑用） */
  async manualRun(periodKey: string, periodStart: Date, periodEnd: Date) {
    this.logger.log(`手動觸發結算：${periodKey}`);
    return this.settlementService.createForPeriod({ periodKey, periodStart, periodEnd });
  }

  private async runSettlement(period: {
    periodKey: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const created = await this.settlementService.createForPeriod(period);
    this.logger.log(
      `期 ${period.periodKey} [${period.periodStart.toISOString()} ~ ${period.periodEnd.toISOString()}) ` +
        `產生 ${created.length} 筆結算`,
    );
  }
}
