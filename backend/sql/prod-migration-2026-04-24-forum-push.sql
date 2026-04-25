-- =====================================================================
-- 始祖天堂 論壇推文獎勵申請模組 Schema
-- 日期：2026-04-24
-- 目的：建立論壇推文申請、明細、獎勵設定、全域設定四張表
-- =====================================================================

BEGIN;

-- 申請主檔
CREATE TABLE IF NOT EXISTS forum_push_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_user_id  uuid NOT NULL,
  game_account     varchar(120) NOT NULL,
  game_character   varchar(120),
  fb_name          varchar(200) NOT NULL,
  fb_link          varchar(500) NOT NULL,
  status           varchar(32) NOT NULL DEFAULT 'pending',
  passed_count     int NOT NULL DEFAULT 0,
  reward_status    varchar(32) NOT NULL DEFAULT 'pending',
  reward_payload   jsonb,
  review_note      text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  ip_address       varchar(64),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_push_applications_user_created
  ON forum_push_applications(website_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_push_applications_status_created
  ON forum_push_applications(status, created_at);

-- 推文明細
CREATE TABLE IF NOT EXISTS forum_push_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES forum_push_applications(id) ON DELETE CASCADE,
  sort_order      int NOT NULL DEFAULT 0,
  type            varchar(32) NOT NULL,
  content         text NOT NULL,
  normalized_url  varchar(500),
  review_result   varchar(32) NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_push_items_app_sort
  ON forum_push_items(application_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_forum_push_items_normalized_url
  ON forum_push_items(normalized_url);

-- 獎勵道具設定
CREATE TABLE IF NOT EXISTS forum_push_reward_configs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code          int NOT NULL,
  item_name          varchar(200) NOT NULL,
  quantity_per_pass  int NOT NULL,
  sort_order         int NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- 全域設定（singleton）
CREATE TABLE IF NOT EXISTS forum_push_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_applications_per_day    int NOT NULL DEFAULT 1,
  max_items_per_application   int NOT NULL DEFAULT 5,
  duplicate_url_policy        varchar(32) NOT NULL DEFAULT 'warn',
  page_description            text,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMIT;
