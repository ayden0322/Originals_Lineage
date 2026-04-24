/**
 * Scenario 08: 一鍵發放達標里程碑
 *   建 4 個里程碑：
 *     A: 達標 + 有道具 → 應啟動
 *     B: 達標 + 無道具 → 跳過
 *     C: 未達標 + 有道具 → 跳過
 *     D: 達標 + 有道具 + is_active=false → 跳過
 *   期望：startedMilestoneIds 只有 A
 */
import { callApi } from '../lib/http';
import { assertEq, assertTrue, waitFor } from '../lib/assert';
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

  await seedReservations(10);
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });

  const A = await seedMilestone({
    threshold: 5,
    rewardName: 'A',
    gameItemId: 60000001,
    gameItemName: '事前預約-第一階段獎勵',
  });
  const B = await seedMilestone({
    threshold: 5,
    rewardName: 'B',
    // 無 gameItemId
  });
  const C = await seedMilestone({
    threshold: 999,
    rewardName: 'C',
    gameItemId: 60000002,
    gameItemName: '事前預約-第二階段獎勵',
  });
  const D = await seedMilestone({
    threshold: 5,
    rewardName: 'D',
    gameItemId: 60000003,
    gameItemName: '事前預約-第三階段獎勵',
    isActive: false,
  });

  const res = await callApi<{
    startedMilestoneIds: string[];
    perMilestone: Array<{ milestoneId: string; created: number }>;
  }>('POST', `/modules/originals/reservations/distribute-all-reached`);

  assertTrue(res.ok, `ok status=${res.status}`);
  const started = res.body!.startedMilestoneIds;
  assertEq(started.length, 1, '啟動里程碑數');
  assertEq(started[0], A, '啟動的應是 A');
  assertTrue(!started.includes(B), 'B 不該啟動');
  assertTrue(!started.includes(C), 'C 不該啟動');
  assertTrue(!started.includes(D), 'D 不該啟動');

  // A 的 pending 應該被建立並寄送
  await waitFor(
    async () => {
      const r = await pgQuery<{ c: string }>(
        `SELECT COUNT(*) AS c FROM reservation_reward_claims
         WHERE milestone_id = $1 AND status = 'sent'`,
        [A],
      );
      return Number(r[0].c) === 10;
    },
    { timeoutMs: 30_000, label: 'A 的 10 筆 claim 全 sent' },
  );

  // B/C/D 沒有任何 claim
  for (const mid of [B, C, D]) {
    const r = await pgQuery<{ c: string }>(
      `SELECT COUNT(*) AS c FROM reservation_reward_claims WHERE milestone_id = $1`,
      [mid],
    );
    assertEq(Number(r[0].c), 0, `milestone ${mid} 不該有 claim`);
  }
}
