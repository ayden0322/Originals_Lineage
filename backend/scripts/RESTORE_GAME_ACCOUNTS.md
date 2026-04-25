# 遊戲資料庫帳號還原 Runbook

> 災難恢復用。當遊戲資料庫 (MySQL `ancestor.accounts`) 被清空或帳號遺失時，從主庫 (PostgreSQL `website_users.password_encrypted`) 解密並寫回遊戲庫。

## 何時使用

- ✅ 遊戲庫 `accounts` 表被清空 / 誤刪
- ✅ 遊戲庫被還原到舊備份，新註冊帳號遺失
- ❌ **不要**拿來批次改密碼（會覆蓋玩家在遊戲內自己改的密碼）

## 風險與注意事項

1. **覆蓋風險**：腳本用 `INSERT ... ON DUPLICATE KEY UPDATE`。若玩家在遊戲內改過密碼，還原會把他們的新密碼覆蓋回註冊當下那版。
2. **單點故障**：整條還原鏈路靠 `PASSWORD_ENC_KEY` 這把金鑰。金鑰遺失 = 所有 `password_encrypted` 變廢資料。
3. **涵蓋範圍**：只能還原「有 `password_encrypted` 的帳號」。註冊於 2026-04-21 之前的 8 筆舊測試資料已刪，所以不算。未來新註冊的都會自動雙寫。
4. **第二密碼**：只還原主密碼。第二密碼存在主庫 `second_password_plain`（明文），遊戲庫目前沒對應欄位，不涉及還原。

## 關鍵資訊（Zeabur Production）

| 項目 | 值 |
|---|---|
| Project ID | `69c7776582fb34707a9f999d` (originals-lineage) |
| PostgreSQL service ID | `69c77814a972bb88a762dd8a` |
| Backend service ID | `69c7932fa972bb88a762eace` (backend-ori) |
| 遊戲庫連線 | 存於 `module_configs.config_json.gameDb`（動態讀） |
| 遊戲庫表對應 | 存於 `module_configs.config_json.gameTableMapping` |
| 加密金鑰 | `PASSWORD_ENC_KEY` 環境變數（backend-ori 服務內） |

## 前置檢查

```bash
# 1. 確認登入 Zeabur
/opt/homebrew/bin/npx zeabur@latest auth status -i=false

# 2. 確認主庫有待還原帳號 + 每筆都有 password_encrypted
/opt/homebrew/bin/npx zeabur@latest service exec --id 69c77814a972bb88a762dd8a -- \
  psql -U platform_admin -d platform_db -c \
  "SELECT game_account_name, (password_encrypted IS NOT NULL) AS has_enc FROM website_users;"

# 3. 確認 backend 服務有 PASSWORD_ENC_KEY
/opt/homebrew/bin/npx zeabur@latest variable list --id 69c7932fa972bb88a762eace -i=false | grep PASSWORD_ENC_KEY
```

## 執行還原（主流程）

> 由於 Zeabur backend 是 production 建置，沒有 `ts-node`，所以 `backend/scripts/restore-game-accounts.ts` **不能**直接在容器跑。改用下方 inline Node 腳本（邏輯等價，相依套件 `pg` + `mysql2` 容器已內建）。

### 步驟 1：dry-run 預覽（不寫入）

目前 inline 版本沒做 dry-run，若要預覽可直接看 SELECT：

```bash
/opt/homebrew/bin/npx zeabur@latest service exec --id 69c77814a972bb88a762dd8a -- \
  psql -U platform_admin -d platform_db -c \
  "SELECT game_account_name FROM website_users WHERE password_encrypted IS NOT NULL;"
```

（這列表就是實跑時會寫進遊戲庫 `accounts` 的帳號名）

### 步驟 2：實際還原

從**本機**透過 Zeabur CLI 直接 exec 進 backend 容器跑：

```bash
/opt/homebrew/bin/npx zeabur@latest service exec --id 69c7932fa972bb88a762eace -- node -e "
(async () => {
  const { Client } = require('pg');
  const mysql = require('mysql2/promise');
  const crypto = require('crypto');

  const pg = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await pg.connect();

  const cfg = await pg.query(\"SELECT config_json FROM module_configs WHERE module_code='originals-lineage'\");
  const mapping = cfg.rows[0].config_json.gameTableMapping;
  const gameDb = cfg.rows[0].config_json.gameDb;
  console.log('[info] target table:', mapping.tableName, 'encryption:', mapping.passwordEncryption);

  const users = await pg.query(\"SELECT game_account_name, password_encrypted FROM website_users WHERE password_encrypted IS NOT NULL\");
  console.log('[info] users with password_encrypted:', users.rows.length);

  const key = Buffer.from(process.env.PASSWORD_ENC_KEY, 'hex');
  const decrypt = (payload) => {
    const parts = payload.split(':');
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const enc = Buffer.from(parts[2], 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  };
  const hashPw = (plain, enc) => {
    if (enc === 'plaintext') return plain;
    if (enc === 'md5') return crypto.createHash('md5').update(plain).digest('hex');
    if (enc === 'sha1') return crypto.createHash('sha1').update(plain).digest('hex');
    if (enc === 'sha256') return crypto.createHash('sha256').update(plain).digest('hex');
    throw new Error('unsupported encryption: ' + enc);
  };

  const mc = await mysql.createConnection({
    host: gameDb.host, port: gameDb.port || 3306,
    user: gameDb.username, password: gameDb.password, database: gameDb.database,
  });

  let ok = 0, fail = 0;
  for (const u of users.rows) {
    try {
      const plain = decrypt(u.password_encrypted);
      const gameHash = hashPw(plain, mapping.passwordEncryption);
      await mc.execute(
        'INSERT INTO \`' + mapping.tableName + '\` (\`' + mapping.columns.username + '\`, \`' + mapping.columns.password + '\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`' + mapping.columns.password + '\` = VALUES(\`' + mapping.columns.password + '\`)',
        [u.game_account_name, gameHash]
      );
      console.log('[ok]', u.game_account_name);
      ok++;
    } catch (e) {
      console.error('[fail]', u.game_account_name, e.message);
      fail++;
    }
  }
  console.log('=== done ok:' + ok + ' fail:' + fail);
  await mc.end();
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
"
```

### 步驟 3：驗證遊戲庫已寫入

```bash
/opt/homebrew/bin/npx zeabur@latest service exec --id 69c7932fa972bb88a762eace -- node -e "
(async () => {
  const { Client } = require('pg');
  const mysql = require('mysql2/promise');
  const pg = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await pg.connect();
  const cfg = await pg.query(\"SELECT config_json FROM module_configs WHERE module_code='originals-lineage'\");
  const gameDb = cfg.rows[0].config_json.gameDb;
  const mapping = cfg.rows[0].config_json.gameTableMapping;
  const mc = await mysql.createConnection({
    host: gameDb.host, port: gameDb.port || 3306,
    user: gameDb.username, password: gameDb.password, database: gameDb.database,
  });
  const users = await pg.query('SELECT game_account_name FROM website_users WHERE password_encrypted IS NOT NULL');
  const names = users.rows.map(u => u.game_account_name);
  const [rows] = await mc.query(
    'SELECT \`' + mapping.columns.username + '\` AS login FROM \`' + mapping.tableName + '\` WHERE \`' + mapping.columns.username + '\` IN (?)',
    [names]
  );
  console.log('主庫應還原:', names.length, '筆');
  console.log('遊戲庫實際存在:', rows.length, '筆');
  const missing = names.filter(n => !rows.find(r => r.login === n));
  if (missing.length) console.error('[缺漏]', missing);
  else console.log('[全部還原成功]');
  await mc.end();
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
"
```

## 疑難排解

### 問題：`PASSWORD_ENC_KEY environment variable is not set`

**原因**：backend 服務沒設 env，或 restart 後沒帶上  
**解法**：
```bash
/opt/homebrew/bin/npx zeabur@latest variable list --id 69c7932fa972bb88a762eace -i=false | grep PASSWORD_ENC_KEY
# 若沒有 → 去 Zeabur dashboard 補上，或 CLI:
/opt/homebrew/bin/npx zeabur@latest variable create --id 69c7932fa972bb88a762eace -k "PASSWORD_ENC_KEY=<64-hex-chars>" -y -i=false
/opt/homebrew/bin/npx zeabur@latest service restart --id 69c7932fa972bb88a762eace -y -i=false
```

### 問題：解密失敗 `Unsupported state or unable to authenticate data`

**原因**：金鑰不對（被換過）  
**解法**：確認 `PASSWORD_ENC_KEY` 是**寫入當下**那把金鑰。若金鑰已遺失，無法還原——只能走「玩家下次登入時現場重建」的 fallback 流程。

### 問題：`gameTableMapping 未設定`

**原因**：`module_configs.config_json.gameTableMapping` 為 null  
**解法**：去模組後台 `/module/settings` 頁面設定好表對應（表名、欄位、加密方式），再重跑。

### 問題：`Unknown column` / `doesn't exist`

**原因**：遊戲庫表 schema 和 `gameTableMapping` 設定不符  
**解法**：確認遊戲庫實際的表結構，調整 `gameTableMapping.columns`。

## 金鑰備份位置

> ⚠️ 金鑰若遺失則此 runbook 全部失效。

- 🔐 Zeabur backend env var `PASSWORD_ENC_KEY`（主要來源）
- 🔐 本機 `.env`（開發用）
- 📌 應另備份至密碼管理器（1Password / Bitwarden 等）

---

**最後一次驗證通過**：2026-04-21（ayden001 測試帳號完整還原鏈路實測成功）  
**相關程式碼**：
- 加密工具：[`src/modules/originals-lineage/member/utils/password-crypto.ts`](../src/modules/originals-lineage/member/utils/password-crypto.ts)
- 註冊雙寫：[`src/modules/originals-lineage/member/member.service.ts`](../src/modules/originals-lineage/member/member.service.ts) 的 `register()` 與 `changePassword()`
- 腳本原始檔：[`scripts/restore-game-accounts.ts`](./restore-game-accounts.ts)（僅能在 dev 環境用 ts-node 跑，production 請用本文件 inline 版）
