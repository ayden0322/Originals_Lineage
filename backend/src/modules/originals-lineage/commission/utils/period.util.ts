/**
 * 結算期計算工具
 *
 * 規則（詳見 分潤系統設計文件.md 第六章）：
 * - settlementDay > 當月天數 → 抓當月最後一天
 * - 採左閉右開區間 [start, end)，結算日當天 00:00 算下一期
 * - period_key 以「該期起始月份」為準（例如 [2026-04-05, 2026-05-05) → '2026-04'）
 */

export interface PeriodRange {
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
}

/** 取某年某月的天數 */
export function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

/** 取該月實際結算日（settlementDay > 當月天數時抓最後一天） */
export function effectiveSettlementDay(
  year: number,
  monthZeroBased: number,
  settlementDay: number,
): number {
  return Math.min(settlementDay, daysInMonth(year, monthZeroBased));
}

/** 該年該月的結算切點（當月實際結算日 00:00:00） */
export function settlementCutPoint(
  year: number,
  monthZeroBased: number,
  settlementDay: number,
): Date {
  const day = effectiveSettlementDay(year, monthZeroBased, settlementDay);
  return new Date(year, monthZeroBased, day, 0, 0, 0, 0);
}

/** 由 periodStart 推導 period_key（'YYYY-MM'） */
export function periodKeyOf(periodStart: Date): string {
  const y = periodStart.getFullYear();
  const m = String(periodStart.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * 計算「now 所在的當前期」
 * 例：settlementDay=5
 *  - now=2026-04-14 → 上一個切點 4/5，下一個 5/5 → 當前期 [4/5, 5/5) = '2026-04'
 *  - now=2026-04-03 → 上一個切點 3/5，下一個 4/5 → 當前期 [3/5, 4/5) = '2026-03'
 */
export function getCurrentPeriod(now: Date, settlementDay: number): PeriodRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonthCut = settlementCutPoint(y, m, settlementDay);

  let periodStart: Date;
  let periodEnd: Date;
  if (now.getTime() >= thisMonthCut.getTime()) {
    // 已過當月切點 → 期 = [當月切點, 下月切點)
    periodStart = thisMonthCut;
    periodEnd = settlementCutPoint(y, m + 1, settlementDay);
  } else {
    // 還沒到當月切點 → 期 = [上月切點, 當月切點)
    periodStart = settlementCutPoint(y, m - 1, settlementDay);
    periodEnd = thisMonthCut;
  }
  return {
    periodKey: periodKeyOf(periodStart),
    periodStart,
    periodEnd,
  };
}

/**
 * 計算「上一期」（cron 在結算日當天 00:00 執行時，要結算的就是上一期）
 * 例：settlementDay=5，now=2026-05-05 00:00 → 上一期 [4/5, 5/5)
 */
export function getPreviousPeriod(now: Date, settlementDay: number): PeriodRange {
  const cur = getCurrentPeriod(now, settlementDay);
  // 「now 剛好在切點」時，getCurrentPeriod 會把 now 算進新的當期
  // → 上一期就是當期之前那段
  const prevStart = settlementCutPoint(
    cur.periodStart.getFullYear(),
    cur.periodStart.getMonth() - 1,
    settlementDay,
  );
  return {
    periodKey: periodKeyOf(prevStart),
    periodStart: prevStart,
    periodEnd: cur.periodStart,
  };
}

/** 今天是否為結算日（含月底邊界） */
export function isSettlementDayToday(now: Date, settlementDay: number): boolean {
  const today = now.getDate();
  const effective = effectiveSettlementDay(
    now.getFullYear(),
    now.getMonth(),
    settlementDay,
  );
  return today === effective;
}
