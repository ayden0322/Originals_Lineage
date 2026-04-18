-- ============================================================
-- 禮包管理模組建立腳本（2026-04）
-- 對應需求：新增 package-manage 模組（禮包內容公開頁 + 後台管理）
--
-- 在 PostgreSQL 上執行一次（生產環境 synchronize=false 必跑）：
--   psql $DATABASE_URL -f scripts/upgrade-packages-2026-04.sql
--
-- 開發環境（synchronize=true）會自動建表，可略過本腳本。
-- ============================================================

BEGIN;

-- ─── 1. game_packages 表（禮包清單） ─────────────────────────
CREATE TABLE IF NOT EXISTS game_packages (
  id               uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             varchar      NOT NULL,
  description      text,
  image_url        varchar,
  large_image_url  varchar,
  currency_amount  integer      NOT NULL DEFAULT 0,
  items_json       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  content_html     text,
  is_active        boolean      NOT NULL DEFAULT true,
  sort_order       integer      NOT NULL DEFAULT 0,
  created_at       timestamp    NOT NULL DEFAULT now(),
  updated_at       timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_packages_active_sort
  ON game_packages (is_active, sort_order);

-- ─── 2. 若表已存在但缺 content_html 欄位（早期版本），補上 ──
ALTER TABLE game_packages
  ADD COLUMN IF NOT EXISTS content_html text;

COMMIT;

-- ─── 驗證 ────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'game_packages'
-- ORDER BY ordinal_position;
