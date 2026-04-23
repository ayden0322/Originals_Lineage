-- ============================================================
-- 分潤血盟 snapshot 升級腳本（2026-04）
-- 對應需求：結算管理頁「血盟統計」Tab
--
-- 在 PostgreSQL 上執行一次：
--   psql $DATABASE_URL -f scripts/upgrade-commission-clan-2026-04.sql
--
-- 開發環境（synchronize=true）會自動建立欄位/索引，
-- 正式環境（synchronize=false）必須跑這份 SQL 才能讓 clan-stats API 運作。
-- 無此欄位時 GET /settlements/clan-stats 會回 500。
-- ============================================================

BEGIN;

-- ─── commission_records 新增血盟 snapshot 欄位 ────────────────
--  clan_id：遊戲庫 characters.ClanID；無血盟或查不到角色 → NULL
--  clan_name：遊戲庫 clan_data.clan_name；用來避免血盟改名後歷史資料錯亂
--  儲值當下即時 snapshot，寫入後不再變動
ALTER TABLE commission_records
  ADD COLUMN IF NOT EXISTS clan_id    integer,
  ADD COLUMN IF NOT EXISTS clan_name  varchar(64);

-- ─── 索引：加速 /settlements/clan-stats 的 GROUP BY ────────────
CREATE INDEX IF NOT EXISTS idx_commission_records_period_clan
  ON commission_records (period_key, clan_id);

COMMIT;

-- ============================================================
-- 執行後建議動作：
--
-- 1. 重新整理 /module/commission/settlements → 「血盟統計」Tab 應該能載入
--    （舊紀錄會全部顯示為「無血盟」，因為還沒 backfill）
--
-- 2. 若要讓歷史資料帶上血盟歸屬：
--      npx ts-node scripts/backfill-commission-clan.ts --dry-run   # 先看
--      npx ts-node scripts/backfill-commission-clan.ts             # 實跑
--    備註：backfill 是用「執行當下」的遊戲庫狀態回填，不精確但讓舊資料
--          有歸屬可觀察。新產生的紀錄才是真正的「儲值當下血盟」。
-- ============================================================
