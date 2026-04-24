/**
 * Scenario 03: 所有條件通過 → validate 回 ok=true, issues=[]
 */
import { callApi } from '../lib/http';
import { assertEq, assertTrue } from '../lib/assert';
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
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) }); // 已截止
  const milestoneId = await seedMilestone({
    threshold: 5,
    rewardName: '第一階段獎勵',
    gameItemId: 60000001,
    gameItemName: '事前預約-第一階段獎勵',
    gameItemQuantity: 1,
  });

  const res = await callApi<{ ok: boolean; issues: Array<{ code: string }> }>(
    'GET',
    `/modules/originals/reservations/milestones/${milestoneId}/validate`,
  );

  assertTrue(
    res.body!.ok,
    'validation should pass',
    `issues: ${JSON.stringify(res.body!.issues)}`,
  );
  assertEq(res.body!.issues.length, 0, 'issues count');
}
