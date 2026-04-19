-- ============================================================
-- 商品詳細內容富文本升級腳本（2026-04）
-- 對應需求：贊助頁與禮包頁 UX 一致化，products 表新增 content_html 欄位
--
-- 在 PostgreSQL 上執行一次（生產環境 synchronize=false 必跑）：
--   psql $DATABASE_URL -f scripts/upgrade-shop-content-html-2026-04.sql
--
-- 開發環境（synchronize=true）會自動建欄位，但仍建議執行本腳本以做資料遷移。
-- 本腳本為冪等設計：多次執行不會造成副作用。
-- ============================================================

BEGIN;

-- ─── 1. products 新增 content_html 欄位（與 game_packages.content_html 對應） ──
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS content_html text;

-- ─── 2. 資料遷移：既有 description 若有內容，且 content_html 尚為 NULL，
--        將 description 複製到 content_html，以便舊商品在前台詳情彈窗顯示原有內文。
--        description 保留作為卡片列表的 2 行簡短摘要（與禮包頁相同）。
UPDATE products
SET content_html = description
WHERE content_html IS NULL
  AND description IS NOT NULL
  AND length(trim(description)) > 0;

COMMIT;

-- ─── 驗證 ────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'products' AND column_name = 'content_html';
--
-- SELECT COUNT(*) AS with_content_html FROM products
-- WHERE content_html IS NOT NULL AND length(trim(content_html)) > 0;
