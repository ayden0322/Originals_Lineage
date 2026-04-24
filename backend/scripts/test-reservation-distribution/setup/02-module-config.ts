/**
 * 確保 module_configs 的 gameDb 設定指向本地 mysql 容器。
 * 程式碼啟動時會讀 module_configs.config_json.gameDb 來初始化連線。
 */
import { Client } from 'pg';

// 在 backend container 內跑時用 service name，host 端跑時用 localhost
const INSIDE_CONTAINER = process.env.INSIDE_DOCKER === '1' || !!process.env.POSTGRES_HOST;
const PG = {
  host: INSIDE_CONTAINER ? process.env.POSTGRES_HOST || 'postgres' : 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER || 'platform_admin',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  database: process.env.POSTGRES_DB || 'platform_db',
};

const TARGET_GAME_DB = {
  connectionName: 'local-test',
  // 跑在 docker 內部網路：backend 透過 mysql-host 連 mysql container
  host: 'mysql',
  port: 3306,
  database: 'endless_paradise',
  username: 'root',
  password: 'root',
};

const TARGET_TABLE_MAPPING = {
  tableName: 'accounts',
  columns: {
    username: 'login',
    password: 'password',
    email: null,
    status: null,
  },
  passwordEncryption: 'plaintext',
  hasEmailColumn: false,
  hasStatusColumn: false,
};

async function main() {
  const client = new Client(PG);
  await client.connect();
  try {
    const res = await client.query(
      `SELECT config_json FROM module_configs WHERE module_code = $1`,
      ['originals-lineage'],
    );

    const existingConfig =
      (res.rows[0]?.config_json as Record<string, unknown> | undefined) ?? {};

    const newConfig = {
      ...existingConfig,
      gameDb: TARGET_GAME_DB,
      gameTableMapping: TARGET_TABLE_MAPPING,
    };

    if (res.rowCount === 0) {
      await client.query(
        `INSERT INTO module_configs (module_code, module_name, is_active, config_json)
         VALUES ($1, $2, true, $3)`,
        ['originals-lineage', 'Originals Lineage', JSON.stringify(newConfig)],
      );
      console.log('[config] inserted new module_configs row for originals-lineage');
    } else {
      await client.query(
        `UPDATE module_configs SET config_json = $1, updated_at = NOW()
         WHERE module_code = $2`,
        [JSON.stringify(newConfig), 'originals-lineage'],
      );
      console.log('[config] updated module_configs.gameDb');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
