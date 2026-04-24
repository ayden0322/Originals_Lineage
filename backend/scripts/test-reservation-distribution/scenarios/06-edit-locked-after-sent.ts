/**
 * Scenario 06: 已有 sent claim 時嘗試更換綁定道具 → 400
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

  await seedReservations(3);
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });
  const milestoneId = await seedMilestone({
    threshold: 1,
    rewardName: '鎖定測試',
    gameItemId: 60000001,
    gameItemName: '事前預約-第一階段獎勵',
  });

  // 先發放完成 → 產生 sent claim
  await callApi(
    'POST',
    `/modules/originals/reservations/milestones/${milestoneId}/start-distribution`,
  );
  await waitFor(
    async () => {
      const r = await pgQuery<{ c: string }>(
        `SELECT COUNT(*) AS c FROM reservation_reward_claims
         WHERE milestone_id = $1 AND status = 'sent'`,
        [milestoneId],
      );
      return Number(r[0].c) === 3;
    },
    { timeoutMs: 30_000, label: '等 3 筆 sent' },
  );

  // editability 應該回 canEdit=false
  const ed = await callApi<{ canEdit: boolean; reason: string | null }>(
    'GET',
    `/modules/originals/reservations/milestones/${milestoneId}/editability`,
  );
  assertEq(ed.body!.canEdit, false, 'editability.canEdit');
  assertTrue(ed.body!.reason !== null, 'editability.reason 應有內容');

  // 嘗試改道具 → 400
  const patchRes = await callApi(
    'PATCH',
    `/modules/originals/reservations/milestones/${milestoneId}`,
    { gameItemId: 60000002, gameItemName: '事前預約-第二階段獎勵' },
  );
  assertEq(patchRes.status, 400, 'PATCH 應被擋下（400）');
}
