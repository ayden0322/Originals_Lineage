/**
 * 分潤紀錄血盟 snapshot backfill
 *
 * 用途：把歷史 commission_records 的 clan_id / clan_name 用「執行當下」的遊戲庫
 * 血盟狀態回填。既有資料歸屬一律以「backfill 當天角色所在血盟」為準；之後新產生
 * 的紀錄才是真正的「儲值當下血盟」。
 *
 * 只更新 clan_id IS NULL AND clan_name IS NULL 的紀錄，可重複執行（idempotent）。
 * 遊戲庫查不到角色或無血盟的玩家 → 該筆紀錄兩欄維持 NULL（UI 顯示「無血盟」）。
 *
 * 執行：
 *   # dry-run
 *   npx ts-node scripts/backfill-commission-clan.ts --dry-run
 *   # 實際寫入
 *   npx ts-node scripts/backfill-commission-clan.ts
 */
import { DataSource } from 'typeorm';
import * as mysql from 'mysql2/promise';

type GameDbConfig = {
  host: string;
  port?: number;
  username: string;
  password: string;
  database: string;
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const pg = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await pg.initialize();

  // 讀 gameDb 連線資訊
  const [configRow] = await pg.query(
    `SELECT config_json FROM module_configs WHERE module_code = 'originals-lineage' LIMIT 1`,
  );
  if (!configRow) throw new Error('找不到 originals-lineage module config');
  const gameDbConfig: GameDbConfig | undefined = configRow.config_json?.gameDb;
  if (!gameDbConfig?.host) throw new Error('gameDb 連線資訊未設定');

  console.log(`[info] 目標遊戲庫：${gameDbConfig.host}/${gameDbConfig.database}`);
  console.log(`[info] dryRun：${dryRun}`);

  // 1. 撈出所有待回填紀錄的玩家 → 遊戲帳號映射
  const playerRows: Array<{ player_id: string; game_account_name: string | null }> =
    await pg.query(
      `SELECT DISTINCT r.player_id, u.game_account_name
       FROM commission_records r
       LEFT JOIN website_users u ON u.id = r.player_id
       WHERE r.clan_id IS NULL AND r.clan_name IS NULL`,
    );

  console.log(`[info] 待回填的不重複玩家數：${playerRows.length}`);

  const accountNames = playerRows
    .map((r) => r.game_account_name)
    .filter((v): v is string => !!v);

  if (accountNames.length === 0) {
    console.log('[info] 沒有對應的遊戲帳號，結束');
    await pg.destroy();
    return;
  }

  // 2. 批次查遊戲庫血盟
  const mysqlConn = await mysql.createConnection({
    host: gameDbConfig.host,
    port: gameDbConfig.port || 3306,
    user: gameDbConfig.username,
    password: gameDbConfig.password,
    database: gameDbConfig.database,
  });

  const clanByAccount = new Map<
    string,
    { clanId: number | null; clanName: string | null }
  >();

  // 分批避免超過 MySQL prepared statement 參數上限
  const CHUNK = 500;
  for (let i = 0; i < accountNames.length; i += CHUNK) {
    const batch = accountNames.slice(i, i + CHUNK);
    const placeholders = batch.map(() => '?').join(',');
    const [rows] = await mysqlConn.query(
      `SELECT c.account_name, c.ClanID AS clan_id, cl.clan_name
       FROM characters c
       LEFT JOIN clan_data cl ON cl.clan_id = c.ClanID
       WHERE c.account_name IN (${placeholders})`,
      batch,
    );
    for (const row of rows as Array<{
      account_name: string;
      clan_id: number | null;
      clan_name: string | null;
    }>) {
      const rawClanId = row.clan_id;
      const clanId =
        rawClanId === null || rawClanId === undefined || Number(rawClanId) <= 0
          ? null
          : Number(rawClanId);
      clanByAccount.set(row.account_name, {
        clanId,
        clanName: row.clan_name ?? null,
      });
    }
  }
  await mysqlConn.end();

  console.log(`[info] 遊戲庫查到 ${clanByAccount.size} 筆帳號血盟資料`);

  // 3. 更新 PG：每個 player_id 一次 UPDATE
  let updatedRowsTotal = 0;
  let playersWithClan = 0;
  let playersWithoutClan = 0;

  for (const p of playerRows) {
    const account = p.game_account_name;
    const hit = account ? clanByAccount.get(account) : undefined;

    if (!hit || (hit.clanId === null && hit.clanName === null)) {
      // 查不到角色 or 角色無血盟 → 維持 NULL（UI 顯示「無血盟」）
      playersWithoutClan++;
      continue;
    }

    playersWithClan++;

    if (dryRun) {
      console.log(
        `[dry] player=${p.player_id} account=${account} → clan_id=${hit.clanId} clan_name=${hit.clanName}`,
      );
      continue;
    }

    const result = await pg.query(
      `UPDATE commission_records
       SET clan_id = $1, clan_name = $2
       WHERE player_id = $3 AND clan_id IS NULL AND clan_name IS NULL`,
      [hit.clanId, hit.clanName, p.player_id],
    );
    // typeorm 的 query() 回傳 [rows, rowCount?]，但不同驅動不一致，保守處理
    const affected = Array.isArray(result) && typeof result[1] === 'number'
      ? (result[1] as number)
      : 0;
    updatedRowsTotal += affected;
  }

  await pg.destroy();

  console.log(`\n=== 完成 ===`);
  console.log(`有血盟的玩家數：${playersWithClan}`);
  console.log(`無血盟（含查不到角色）的玩家數：${playersWithoutClan}`);
  if (!dryRun) console.log(`實際更新 commission_records 筆數：${updatedRowsTotal}`);
}

main().catch((err) => {
  console.error('腳本執行失敗：', err);
  process.exit(1);
});
