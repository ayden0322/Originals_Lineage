/**
 * Scenario 09: UNIQUE (reservation_id, milestone_id) 保證不會產生重複 claim
 *   多次同時打 start-distribution 並並行跑，最終只會有 N 筆 claim（不會變 2N 或爆 error）
 */
import { callApi } from '../lib/http';
import { assertEq, waitFor } from '../lib/assert';
import { pgQuery } from '../lib/db';
import {
  resetReservationData,
  resetGameDbData,
  seedReservations,
  seedMilestone,
  setPageSettings,
} from '../lib/seed';

export async function run(): Promise<void> {
  await resetReservationData();
  await resetGameDbData();

  await seedReservations(8);
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });
  const milestoneId = await seedMilestone({
    threshold: 1,
    rewardName: 'UNIQUE 測試',
    gameItemId: 60000004,
    gameItemName: '事前預約-第四階段獎勵',
  });

  // 同時啟動 3 次
  const results = await Promise.all([
    callApi('POST', `/modules/originals/reservations/milestones/${milestoneId}/start-distribution`),
    callApi('POST', `/modules/originals/reservations/milestones/${milestoneId}/start-distribution`),
    callApi('POST', `/modules/originals/reservations/milestones/${milestoneId}/start-distribution`),
  ]);

  const totalCreated = results.reduce((acc, r) => {
    const body = r.body as { created?: number } | null;
    return acc + (body?.created ?? 0);
  }, 0);
  // 三次合計的 created 不一定是 8（第一名搶到 8，其他兩個為 0）
  // 但絕對不能超過 8
  if (totalCreated > 8) {
    throw new Error(`totalCreated=${totalCreated} 超過 reservation 數 8`);
  }

  // 等到全部 sent
  await waitFor(
    async () => {
      const r = await pgQuery<{ c: string }>(
        `SELECT COUNT(*) AS c FROM reservation_reward_claims
         WHERE milestone_id = $1 AND status = 'sent'`,
        [milestoneId],
      );
      return Number(r[0].c) === 8;
    },
    { timeoutMs: 30_000, label: '8 筆全 sent' },
  );

  // 最終一定剛好 8 筆（不會多也不會少）
  const finalCount = await pgQuery<{ c: string }>(
    `SELECT COUNT(*) AS c FROM reservation_reward_claims WHERE milestone_id = $1`,
    [milestoneId],
  );
  assertEq(Number(finalCount[0].c), 8, '最終 claim 數 = 預約數');
}
