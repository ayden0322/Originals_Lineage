/**
 * Scenario 04 (Happy Path):
 *   10 預約 → milestone 5 人門檻 → start-distribution
 *   → 所有 10 筆 claim 變 sent
 *   → 遊戲 DB 輔助_獎勵發送 有 10 筆對應 row
 *   → gameInsertId 對得上
 */
import { callApi } from '../lib/http';
import { assertEq, assertTrue, waitFor, sleep } from '../lib/assert';
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

  await seedReservations(10);
  await setPageSettings({ deadlineAt: new Date(Date.now() - 1000) });
  const milestoneId = await seedMilestone({
    threshold: 5,
    rewardName: '第一階段獎勵',
    gameItemId: 60000001,
    gameItemName: '事前預約-第一階段獎勵',
    gameItemQuantity: 2,
  });

  // Start distribution
  const startRes = await callApi<{
    created: number;
    skipped: number;
    totalReservations: number;
  }>('POST', `/modules/originals/reservations/milestones/${milestoneId}/start-distribution`);

  assertTrue(startRes.ok, `start-distribution ok, status=${startRes.status}, raw=${JSON.stringify(startRes.raw)}`);
  assertEq(startRes.body!.created, 10, 'created claims');
  assertEq(startRes.body!.totalReservations, 10, 'total reservations');

  // 等背景寄送完成 — processing+pending 歸零，sent=10
  await waitFor(
    async () => {
      const rows = await pgQuery<{ status: string; c: string }>(
        `SELECT status, COUNT(*) AS c FROM reservation_reward_claims
         WHERE milestone_id = $1 GROUP BY status`,
        [milestoneId],
      );
      const byStatus: Record<string, number> = {};
      for (const r of rows) byStatus[r.status] = Number(r.c);
      return byStatus.sent === 10 && !byStatus.pending && !byStatus.processing;
    },
    { timeoutMs: 30_000, intervalMs: 500, label: '等 10 筆 claim 全部 sent' },
  );

  // 遊戲 DB 有 10 筆對應寫入
  const gameRows = await mysqlQuery<{ c: number }>(
    'SELECT COUNT(*) AS c FROM `輔助_獎勵發送` WHERE `獎勵道具編號` = 60000001',
  );
  assertEq(Number(gameRows[0].c), 10, '遊戲 DB 寫入數');

  // gameInsertId 有記錄在 claim
  const claimIds = await pgQuery<{ game_insert_id: number }>(
    `SELECT game_insert_id FROM reservation_reward_claims
     WHERE milestone_id = $1 AND game_insert_id IS NOT NULL`,
    [milestoneId],
  );
  assertEq(claimIds.length, 10, '所有 claim 都有 gameInsertId');

  // 數量欄位驗證：都是 quantity=2
  const qtyRows = await mysqlQuery<{ c: number }>(
    'SELECT COUNT(*) AS c FROM `輔助_獎勵發送` WHERE `獎勵道具數量` = 2',
  );
  assertEq(Number(qtyRows[0].c), 10, '數量=2 的紀錄數');

  // 稍等讓 background 完全停下（避免影響下一個 scenario）
  await sleep(500);
}
