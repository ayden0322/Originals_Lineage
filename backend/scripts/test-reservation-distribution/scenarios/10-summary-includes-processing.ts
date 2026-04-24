/**
 * Scenario 10: getDistributionSummary 正確回傳 4 狀態
 *   手動塞各狀態的 claim，驗證 summary 數字
 */
import { callApi } from '../lib/http';
import { assertEq } from '../lib/assert';
import { pgExec } from '../lib/db';
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

  const { reservationIds } = await seedReservations(8);
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });
  const milestoneId = await seedMilestone({
    threshold: 1,
    rewardName: 'Summary 測試',
    gameItemId: 60000001,
    gameItemName: '事前預約-第一階段獎勵',
  });

  // 手動塞 2 pending / 2 processing / 3 sent / 1 failed
  const statuses = [
    'pending',
    'pending',
    'processing',
    'processing',
    'sent',
    'sent',
    'sent',
    'failed',
  ];
  for (let i = 0; i < 8; i++) {
    await pgExec(
      `INSERT INTO reservation_reward_claims
         (reservation_id, milestone_id, game_account_snapshot,
          reward_name_snapshot, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        reservationIds[i],
        milestoneId,
        `acc-${i}`,
        'Summary 測試',
        statuses[i],
      ],
    );
  }

  const res = await callApi<
    Array<{
      milestoneId: string;
      pending: number;
      processing: number;
      sent: number;
      failed: number;
      total: number;
    }>
  >('GET', `/modules/originals/reservations/distributions`);

  const row = res.body!.find((r) => r.milestoneId === milestoneId);
  if (!row) throw new Error('summary row not found');
  assertEq(row.pending, 2, 'pending count');
  assertEq(row.processing, 2, 'processing count');
  assertEq(row.sent, 3, 'sent count');
  assertEq(row.failed, 1, 'failed count');
  assertEq(row.total, 8, 'total');
}
