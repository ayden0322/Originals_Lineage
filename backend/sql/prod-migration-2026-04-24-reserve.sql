-- =====================================================================
-- 始祖天堂 正式環境 Schema 補正遷移
-- 日期：2026-04-24
-- 目的：把「預約發獎自動化」的新欄位補到 prod，完全保留既有資料
-- 安全性：全部用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重複執行
-- 執行前：建議先 pg_dump 備份一次
--   pg_dump -U platform_admin platform_db > backup_$(date +%Y%m%d).sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. reservation_milestones：綁定遊戲道具的 3 個新欄位
-- ---------------------------------------------------------------------
ALTER TABLE reservation_milestones
  ADD COLUMN IF NOT EXISTS game_item_id       int;
ALTER TABLE reservation_milestones
  ADD COLUMN IF NOT EXISTS game_item_name     varchar;
ALTER TABLE reservation_milestones
  ADD COLUMN IF NOT EXISTS game_item_quantity int NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------
-- 2. reservation_reward_claims：背景寄送狀態追蹤的 3 個新欄位
--    注意：status 欄位型別是 varchar，不是 enum，所以 'processing'
--    值直接可用，不用改 schema
-- ---------------------------------------------------------------------
ALTER TABLE reservation_reward_claims
  ADD COLUMN IF NOT EXISTS game_insert_id   int;
ALTER TABLE reservation_reward_claims
  ADD COLUMN IF NOT EXISTS retry_count      int NOT NULL DEFAULT 0;
ALTER TABLE reservation_reward_claims
  ADD COLUMN IF NOT EXISTS last_attempt_at  timestamptz;

COMMIT;

-- ---------------------------------------------------------------------
-- 驗證（非必要，執行後可手動跑）：
-- \d reservation_milestones
-- \d reservation_reward_claims
-- ---------------------------------------------------------------------
