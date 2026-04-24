/**
 * Scenario 05 (冪等性):
 *   連續呼叫 start-distribution 兩次，第二次 created=0，且遊戲 DB 不會多寫一次。
 */
import { callApi } from '../lib/http';
import { assertEq, assertTrue, waitFor } from '../lib/assert';
import { pgQuery, mysqlQuery } from '../lib/db';
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
    rewardName: '冪等性測試',
    gameItemId: 60000002,
    gameItemName: '事前預約-第二階段獎勵',
  });

  // 第一次
  const r1 = await callApi<{ created: number; skipped: number }>(
    'POST',
    `/modules/originals/reservations/milestones/${milestoneId}/start-distribution`,
  );
  assertEq(r1.body!.created, 5, '第一次 created');

  // 等背景寄送完成
  await waitFor(
    async () => {
      const rows = await pgQuery<{ c: string }>(
        `SELECT COUNT(*) AS c FROM reservation_reward_claims
         WHERE milestone_id = $1 AND status = 'sent'`,
        [milestoneId],
      );
      return Number(rows[0].c) === 5;
    },
    { timeoutMs: 30_000, label: '等 5 筆全 sent' },
  );

  // 第二次 — 冪等：created=0
  const r2 = await callApi<{ created: number; skipped: number }>(
    'POST',
    `/modules/originals/reservations/milestones/${milestoneId}/start-distribution`,
  );
  assertTrue(r2.ok, `第二次 ok, status=${r2.status}`);
  assertEq(r2.body!.created, 0, '第二次 created (應為 0)');
  assertEq(r2.body!.skipped, 5, '第二次 skipped');

  // 遊戲 DB 總數仍應該是 5 筆（沒有重複寫入）
  // 給背景 handler 一點時間消化第二次 event
  await waitFor(
    async () => {
      const r = await mysqlQuery<{ c: number }>(
        'SELECT COUNT(*) AS c FROM `輔助_獎勵發送` WHERE `獎勵道具編號` = 60000002',
      );
      return Number(r[0].c) === 5;
    },
    { timeoutMs: 5_000, intervalMs: 500, label: '遊戲 DB 應維持 5 筆' },
  );

  // 再驗一次確定沒有超過 5
  const final = await mysqlQuery<{ c: number }>(
    'SELECT COUNT(*) AS c FROM `輔助_獎勵發送` WHERE `獎勵道具編號` = 60000002',
  );
  assertEq(Number(final[0].c), 5, '第二次 event 處理後遊戲 DB 仍 5 筆（防重複）');
}
