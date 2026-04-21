/**
 * 遊戲資料庫帳號還原腳本
 *
 * 用途：當遊戲資料庫 (MySQL) 被清空後，從主庫 (PostgreSQL) website_users.password_encrypted
 * 解密明文密碼，寫回遊戲資料庫 accounts 表
 *
 * 執行方式：
 *   # 本機 dry-run（只顯示會做什麼，不實際寫入；需先載入環境變數）
 *   node --env-file=../.env --loader ts-node/esm scripts/restore-game-accounts.ts --dry-run
 *   # 或：set -a; source ../.env; set +a; npx ts-node scripts/restore-game-accounts.ts --dry-run
 *
 *   # Zeabur 線上執行（容器環境已自帶 env，直接跑即可）
 *   npx ts-node scripts/restore-game-accounts.ts
 *
 * 前置條件：
 *   - PASSWORD_ENC_KEY 必須是同一把（加密時用的那把）
 *   - 主庫可連線（POSTGRES_*）
 *   - 遊戲庫設定已配置（module_configs.gameTableMapping）
 */
import { DataSource } from 'typeorm';
import * as mysql from 'mysql2/promise';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { decryptPassword } from '../src/modules/originals-lineage/member/utils/password-crypto';

type GameTableMapping = {
  tableName: string;
  columns: {
    username: string;
    password: string;
    email?: string | null;
    status?: string | null;
  };
  passwordEncryption: 'plaintext' | 'md5' | 'sha1' | 'sha256' | 'bcrypt';
};

function hashGamePassword(
  plain: string,
  encryption: GameTableMapping['passwordEncryption'],
): string {
  switch (encryption) {
    case 'plaintext':
      return plain;
    case 'md5':
      return crypto.createHash('md5').update(plain).digest('hex');
    case 'sha1':
      return crypto.createHash('sha1').update(plain).digest('hex');
    case 'sha256':
      return crypto.createHash('sha256').update(plain).digest('hex');
    case 'bcrypt':
      return bcrypt.hashSync(plain, 10);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // 1. 連主庫 PostgreSQL
  const pg = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await pg.initialize();

  // 2. 讀 gameTableMapping + gameDb 連線資訊
  const [configRow] = await pg.query(
    `SELECT config_json FROM module_configs WHERE module_code = 'originals-lineage' LIMIT 1`,
  );
  if (!configRow) {
    throw new Error('找不到 originals-lineage module config');
  }
  const mapping: GameTableMapping | undefined =
    configRow.config_json?.gameTableMapping;
  const gameDbConfig = configRow.config_json?.gameDb;
  if (!mapping) {
    throw new Error('gameTableMapping 未設定');
  }
  if (!gameDbConfig?.host) {
    throw new Error('gameDb 連線資訊未設定');
  }

  console.log(`[info] 目標遊戲庫：${gameDbConfig.host}/${gameDbConfig.database}`);
  console.log(`[info] 目標表：${mapping.tableName}`);
  console.log(`[info] 加密方式：${mapping.passwordEncryption}`);
  console.log(`[info] dryRun：${dryRun}`);

  // 3. 讀所有官網使用者
  const users: Array<{
    game_account_name: string;
    password_encrypted: string | null;
  }> = await pg.query(
    `SELECT game_account_name, password_encrypted FROM website_users WHERE is_active = true`,
  );
  console.log(`[info] 主庫撈到 ${users.length} 筆 active 使用者`);

  // 4. 連遊戲庫 MySQL
  const mysqlConn = await mysql.createConnection({
    host: gameDbConfig.host,
    port: gameDbConfig.port || 3306,
    user: gameDbConfig.username,
    password: gameDbConfig.password,
    database: gameDbConfig.database,
  });

  // 5. 逐筆還原
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    if (!u.password_encrypted) {
      console.warn(
        `[skip] ${u.game_account_name}：沒有 password_encrypted（舊資料）`,
      );
      skipped++;
      continue;
    }
    try {
      const plain = decryptPassword(u.password_encrypted);
      const gameHash = hashGamePassword(plain, mapping.passwordEncryption);

      if (!dryRun) {
        // INSERT ... ON DUPLICATE KEY UPDATE（兼顧「清空後新寫」與「既有則更新」）
        await mysqlConn.execute(
          `INSERT INTO \`${mapping.tableName}\` (\`${mapping.columns.username}\`, \`${mapping.columns.password}\`)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE \`${mapping.columns.password}\` = VALUES(\`${mapping.columns.password}\`)`,
          [u.game_account_name, gameHash],
        );
      }

      console.log(`[ok] ${u.game_account_name}`);
      ok++;
    } catch (err: any) {
      console.error(`[fail] ${u.game_account_name}：${err.message}`);
      failed++;
    }
  }

  await mysqlConn.end();
  await pg.destroy();

  console.log(`\n=== 完成 ===`);
  console.log(`成功：${ok}`);
  console.log(`略過：${skipped}`);
  console.log(`失敗：${failed}`);
}

main().catch((err) => {
  console.error('腳本執行失敗：', err);
  process.exit(1);
});
