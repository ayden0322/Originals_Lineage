/**
 * Scenario 01: milestone 未綁道具 → validate 回 ok=false，issues 含 NO_ITEM_BOUND
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

  await seedReservations(5);
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });
  const milestoneId = await seedMilestone({
    threshold: 3,
    rewardName: '測試獎勵',
    // 故意不綁 gameItemId
  });

  const res = await callApi<{
    ok: boolean;
    issues: Array<{ code: string; message: string }>;
  }>('GET', `/modules/originals/reservations/milestones/${milestoneId}/validate`);

  assertTrue(res.ok, 'API should return 200', `status=${res.status}`);
  assertTrue(res.body !== null, 'body should not be null');
  assertEq(res.body!.ok, false, 'validation.ok');
  const codes = res.body!.issues.map((i) => i.code);
  assertTrue(
    codes.includes('NO_ITEM_BOUND'),
    'should report NO_ITEM_BOUND',
    `got: ${codes.join(',')}`,
  );
}
