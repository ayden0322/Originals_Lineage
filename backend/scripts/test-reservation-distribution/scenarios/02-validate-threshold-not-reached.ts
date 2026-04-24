/**
 * Scenario 02: 未達標（displayCount < threshold） → validate 含 THRESHOLD_NOT_REACHED
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

  await seedReservations(3); // 只有 3 人
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });
  const milestoneId = await seedMilestone({
    threshold: 10, // 需要 10 人
    rewardName: '遠門檻獎勵',
    gameItemId: 60000001,
    gameItemName: '事前預約-第一階段獎勵',
  });

  const res = await callApi<{ ok: boolean; issues: Array<{ code: string }> }>(
    'GET',
    `/modules/originals/reservations/milestones/${milestoneId}/validate`,
  );

  assertEq(res.body!.ok, false, 'validation.ok');
  const codes = res.body!.issues.map((i) => i.code);
  assertTrue(
    codes.includes('THRESHOLD_NOT_REACHED'),
    'should report THRESHOLD_NOT_REACHED',
    `got: ${codes.join(',')}`,
  );
}
