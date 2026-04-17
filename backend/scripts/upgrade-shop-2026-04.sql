-- ============================================================
-- 商城重構升級腳本（2026-04）
-- 對應需求：分類調整、限購擴充、遊戲庫發貨、商品範本
--
-- 在 PostgreSQL 上執行一次：
--   psql $DATABASE_URL -f scripts/upgrade-shop-2026-04.sql
--
-- 開發環境（synchronize=true）會自動建立新欄位/新表，
-- 但 dev 也建議跑此腳本以執行資料遷移（UPDATE 部分）。
-- ============================================================

BEGIN;

-- ─── 1. products 新增欄位 ─────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS game_item_id          integer,
  ADD COLUMN IF NOT EXISTS game_item_name        varchar(120),
  ADD COLUMN IF NOT EXISTS game_item_quantity    integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS daily_limit           integer,
  ADD COLUMN IF NOT EXISTS weekly_limit          integer,
  ADD COLUMN IF NOT EXISTS weekly_reset_day      smallint,   -- 0=週日 ~ 6=週六
  ADD COLUMN IF NOT EXISTS weekly_reset_hour     smallint,   -- 0~23
  ADD COLUMN IF NOT EXISTS monthly_limit         integer,
  ADD COLUMN IF NOT EXISTS required_level        integer;

-- ─── 2. 既有 category 值遷移 ──────────────────────────────────
-- 舊：diamond_pack / special_bundle / event_pack
-- 新：diamond / game_item / monthly_card
-- 既有資料一律視為鑽石商品
UPDATE products
SET category = 'diamond'
WHERE category IN ('diamond_pack', 'special_bundle', 'event_pack');

-- ─── 3. 新增 product_templates 表（共用商品範本） ──────────────
CREATE TABLE IF NOT EXISTS product_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(120) NOT NULL,
  category    varchar     NOT NULL,
  snapshot    jsonb       NOT NULL,
  created_by  uuid,
  created_at  timestamp   NOT NULL DEFAULT now(),
  updated_at  timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_templates_category
  ON product_templates(category);

COMMIT;

-- ─── 驗證 ────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'products' ORDER BY ordinal_position;
--
-- SELECT category, COUNT(*) FROM products GROUP BY category;
