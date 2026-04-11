-- =====================================================================
-- 始祖天堂 正式環境 Schema 補正遷移
-- 日期：2026-04-09
-- 目的：把商城重構 + 金流路由新表 / 新欄位補到 prod，完全保留既有資料
-- 安全性：全部用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重複執行
-- 執行前：建議先 pg_dump 備份一次
--   pg_dump -U platform_admin platform_db > backup_$(date +%Y%m%d).sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. products：補 9 個新欄位（entity 已在使用，舊資料 NULL/預設值即可）
-- ---------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS game_item_id        int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS game_item_name      varchar(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS game_item_quantity  int NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS daily_limit         int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_limit        int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_reset_day    smallint;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_reset_hour   smallint;
ALTER TABLE products ADD COLUMN IF NOT EXISTS monthly_limit       int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS required_level      int;

-- ---------------------------------------------------------------------
-- 2. product_templates：新表（商品範本 / 常用設定）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(120) NOT NULL,
  category    varchar      NOT NULL,
  snapshot    jsonb        NOT NULL,
  created_by  uuid,
  created_at  timestamp    NOT NULL DEFAULT now(),
  updated_at  timestamp    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_templates_category
  ON product_templates(category);

-- ---------------------------------------------------------------------
-- 3. payment_channel_routes：新表（付款方式 → gateway 路由）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_channel_routes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code     varchar     NOT NULL,
  payment_method  varchar(32) NOT NULL,
  gateway_id      uuid,
  created_at      timestamp   NOT NULL DEFAULT now(),
  updated_at      timestamp   NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_channel_routes_module_method
    UNIQUE (module_code, payment_method)
);

-- ---------------------------------------------------------------------
-- 4. payment_gateways：補新欄位（若 prod 是舊版 schema）
--    這些是 entity 裡已存在的欄位，prod 若沒有就加
-- ---------------------------------------------------------------------
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS vendor_type
  varchar(32) NOT NULL DEFAULT 'mock';
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS product_name
  varchar(128) NOT NULL DEFAULT '';
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS min_amount
  int NOT NULL DEFAULT 0;
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS order_interval
  int NOT NULL DEFAULT 0;
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS real_name_settings
  jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS channel_settings
  jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS is_sandbox
  boolean NOT NULL DEFAULT true;
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS priority
  int NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- 5. 安全驗證：列出遷移後的 schema 供人眼確認
-- ---------------------------------------------------------------------
-- 執行完 COMMIT 後可用下列指令確認：
--   \d products
--   \d product_templates
--   \d payment_channel_routes
--   \d payment_gateways
--   SELECT COUNT(*) FROM products;        -- 確認資料沒不見
--   SELECT COUNT(*) FROM payment_gateways;

COMMIT;
