/**
 * Scenario 07: 有 pending claim 時更改 rewardName，snapshot 應被同步更新
 */
import { callApi } from '../lib/http';
import { assertEq } from '../lib/assert';
import { pgQuery, pgExec } from '../lib/db';
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

  const { reservationIds } = await seedReservations(3);
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });
  const milestoneId = await seedMilestone({
    threshold: 1,
    rewardName: '舊名稱',
    gameItemId: 60000003,
    gameItemName: '事前預約-第三階段獎勵',
  });

  // 手動建 3 筆 pending claim（不經背景寄送，保持 pending）
  for (const rid of reservationIds) {
    await pgExec(
      `INSERT INTO reservation_reward_claims
         (reservation_id, milestone_id, game_account_snapshot,
          reward_name_snapshot, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [rid, milestoneId, `acc-${rid.substring(0, 8)}`, '舊名稱'],
    );
  }

  // PATCH 里程碑改 rewardName
  const patchRes = await callApi(
    'PATCH',
    `/modules/originals/reservations/milestones/${milestoneId}`,
    { rewardName: '新名稱' },
  );
  assertEq(patchRes.ok, true, 'PATCH rewardName 應成功');

  // 驗證所有 pending claim 的 rewardNameSnapshot 已變新名稱
  const claims = await pgQuery<{ reward_name_snapshot: string }>(
    `SELECT reward_name_snapshot FROM reservation_reward_claims
     WHERE milestone_id = $1 AND status = 'pending'`,
    [milestoneId],
  );
  assertEq(claims.length, 3, 'pending claim 數');
  for (const c of claims) {
    assertEq(c.reward_name_snapshot, '新名稱', 'snapshot 已同步');
  }
}
