/**
 * 測試前把 DB 清到乾淨狀態，並塞入需要的基礎資料。
 */
import { pgExec, mysqlExec, pgQuery } from './db';

/** 清掉所有 reservation / claim / milestone / settings / website_users 測試資料 */
export async function resetReservationData(): Promise<void> {
  await pgExec('DELETE FROM reservation_reward_claims');
  await pgExec('DELETE FROM reservation_milestones');
  await pgExec('DELETE FROM reservations');
  await pgExec('DELETE FROM reservation_page_settings');
  // 清測試用的 website_users（保留非 test- prefix 的真實帳號）
  await pgExec(
    `DELETE FROM website_users WHERE email LIKE 'test-%@example.com'`,
  );
}

/** 清遊戲 DB 的寄送紀錄 */
export async function resetGameDbData(): Promise<void> {
  await mysqlExec('TRUNCATE TABLE `輔助_獎勵發送`');
}

/**
 * 建立 N 個測試預約者（website_users + reservations）。
 * 回傳各筆 website_user_id 供後續使用。
 */
export async function seedReservations(
  count: number,
  opts: { countBase?: number; deadlineAt?: Date | null; locked?: boolean } = {},
): Promise<{ websiteUserIds: string[]; reservationIds: string[] }> {
  // page_settings
  await pgExec(
    `INSERT INTO reservation_page_settings
      (page_title, count_base, deadline_at, is_distribution_locked)
     VALUES ($1, $2, $3, $4)`,
    [
      '測試預約活動',
      opts.countBase ?? 0,
      opts.deadlineAt ?? null,
      opts.locked ?? false,
    ],
  );

  const websiteUserIds: string[] = [];
  const reservationIds: string[] = [];

  for (let i = 1; i <= count; i++) {
    const email = `test-user-${i}@example.com`;
    const account = `testacc${i.toString().padStart(4, '0')}`;
    const userRow = await pgQuery<{ id: string }>(
      `INSERT INTO website_users
        (email, game_account_name, password_hash, password_encrypted,
         second_password_hash, second_password_plain,
         is_active, email_verified)
       VALUES ($1, $2, 'x', 'x', 'x', 'x', true, true)
       RETURNING id`,
      [email, account],
    );
    const userId = userRow[0].id;
    websiteUserIds.push(userId);

    const resvRow = await pgQuery<{ id: string }>(
      `INSERT INTO reservations (website_user_id, game_account_name, ip_address)
       VALUES ($1, $2, '127.0.0.1')
       RETURNING id`,
      [userId, account],
    );
    reservationIds.push(resvRow[0].id);
  }

  return { websiteUserIds, reservationIds };
}

/** 建立一個里程碑，回傳 id */
export async function seedMilestone(params: {
  threshold: number;
  rewardName: string;
  gameItemId?: number | null;
  gameItemName?: string | null;
  gameItemQuantity?: number;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<string> {
  const row = await pgQuery<{ id: string }>(
    `INSERT INTO reservation_milestones
      (threshold, reward_name, game_item_id, game_item_name,
       game_item_quantity, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.threshold,
      params.rewardName,
      params.gameItemId ?? null,
      params.gameItemName ?? null,
      params.gameItemQuantity ?? 1,
      params.isActive ?? true,
      params.sortOrder ?? 0,
    ],
  );
  return row[0].id;
}

export async function setPageSettings(opts: {
  countBase?: number;
  deadlineAt?: Date | null;
  locked?: boolean;
}): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (opts.countBase !== undefined) {
    fields.push(`count_base = $${idx++}`);
    values.push(opts.countBase);
  }
  if (opts.deadlineAt !== undefined) {
    fields.push(`deadline_at = $${idx++}`);
    values.push(opts.deadlineAt);
  }
  if (opts.locked !== undefined) {
    fields.push(`is_distribution_locked = $${idx++}`);
    values.push(opts.locked);
  }
  if (fields.length === 0) return;
  await pgExec(
    `UPDATE reservation_page_settings SET ${fields.join(', ')}`,
    values,
  );
}
