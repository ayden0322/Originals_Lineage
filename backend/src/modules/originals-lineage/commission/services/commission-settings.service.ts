import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionSetting } from '../entities/commission-setting.entity';
import { CommissionSettingHistory } from '../entities/commission-setting-history.entity';
import { getCurrentPeriod, periodKeyOf, settlementCutPoint } from '../utils/period.util';

/**
 * 分潤系統設定服務
 *
 * 特殊規則：
 * - settlement_day 變更採「預約下期生效」：當期照舊，下期才用新值
 * - 其他 key 即時生效
 */
@Injectable()
export class CommissionSettingsService {
  constructor(
    @InjectRepository(CommissionSetting)
    private readonly settingRepo: Repository<CommissionSetting>,
    @InjectRepository(CommissionSettingHistory)
    private readonly historyRepo: Repository<CommissionSettingHistory>,
  ) {}

  /** 取得單一設定值（型別由呼叫端轉型） */
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const row = await this.settingRepo.findOne({ where: { key } });
    if (!row) {
      if (defaultValue !== undefined) return defaultValue;
      throw new NotFoundException(`設定 ${key} 不存在`);
    }
    return row.value as T;
  }

  /** 取得結算日（含預約變更處理） */
  async getSettlementDayForPeriod(periodKey: string): Promise<number> {
    // 找出該 period 之前所有的變更，最新的那筆 effective_from_period <= periodKey 即為當期應用值
    const histories = await this.historyRepo.find({
      where: { key: 'settlement_day' },
      order: { changedAt: 'DESC' },
    });

    for (const h of histories) {
      if (h.effectiveFromPeriod && h.effectiveFromPeriod <= periodKey) {
        return Number(h.newValue);
      }
    }
    // 沒命中任何預約變更 → 用當前設定值
    return this.get<number>('settlement_day', 5);
  }

  /** 取得所有設定（key-value map） */
  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.settingRepo.find();
    const map: Record<string, unknown> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  /**
   * 設定/更新值
   * - settlement_day 走預約下期：寫 history（effective_from_period = next period_key），settings 表也立即更新
   * - 其他 key：直接更新 settings 表 + 寫 history
   */
  async set(key: string, value: unknown, operatorId?: string): Promise<void> {
    const existing = await this.settingRepo.findOne({ where: { key } });
    const oldValue = existing?.value ?? null;

    let effectiveFromPeriod: string | null = null;
    if (key === 'settlement_day') {
      const currentDay = (oldValue as number | null) ?? 5;
      const cur = getCurrentPeriod(new Date(), currentDay);
      // 下一期的 periodKey = 當期結束時的下一個結算切點所在月份
      const nextStart = cur.periodEnd;
      effectiveFromPeriod = periodKeyOf(nextStart);
    }

    if (existing) {
      existing.value = value;
      existing.updatedBy = operatorId ?? null;
      await this.settingRepo.save(existing);
    } else {
      await this.settingRepo.save(
        this.settingRepo.create({ key, value, updatedBy: operatorId ?? null }),
      );
    }

    await this.historyRepo.save(
      this.historyRepo.create({
        key,
        oldValue,
        newValue: value,
        effectiveFromPeriod,
        changedBy: operatorId ?? null,
      }),
    );
  }
}
