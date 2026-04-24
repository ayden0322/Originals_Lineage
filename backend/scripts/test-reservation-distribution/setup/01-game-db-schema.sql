-- 測試用遊戲 DB schema（endless_paradise）
-- 實際遊戲 DB 欄位更多，此處只建 backend 程式會讀寫的最小集合

-- 1. etcitem：道具主檔（備查 / 綁定用）
CREATE TABLE IF NOT EXISTS `etcitem` (
  `item_id` INT NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 輔助_獎勵發送：預約發獎 / 商城禮包 寫入對象
--    注意：PK 是 `id`（auto-increment），verifyGiftRewardExists 依賴此欄位名
CREATE TABLE IF NOT EXISTS `輔助_獎勵發送` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `獎勵道具編號` INT NOT NULL,
  `獎勵道具名稱` VARCHAR(200) NULL,
  `強化值` INT NOT NULL DEFAULT 0,
  `獎勵道具數量` INT NOT NULL,
  `指定發送玩家帳號` VARCHAR(100) NOT NULL,
  `是否已送出` TINYINT(1) NOT NULL DEFAULT 0,
  `領取人名稱` VARCHAR(100) NULL,
  `領取時間` DATETIME NULL,
  `領取人ip` VARCHAR(100) NULL,
  `是否已經可以領取` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_account` (`指定發送玩家帳號`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 贊助_儲值記錄：商城鑽石用，測試發獎沒用到，但建 schema 避免其他 code path 報錯
CREATE TABLE IF NOT EXISTS `贊助_儲值記錄` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `p_id` INT NOT NULL,
  `p_name` VARCHAR(100) NULL,
  `count` INT NOT NULL,
  `account` VARCHAR(100) NOT NULL,
  `out` INT NOT NULL DEFAULT 0,
  `play` VARCHAR(100) NULL,
  `play_clanname` VARCHAR(100) NULL,
  `time` DATETIME NULL,
  `ip` VARCHAR(100) NULL,
  `ready` TINYINT(1) NOT NULL DEFAULT 1,
  `trueMoney` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. accounts：遊戲帳號表（測試用最小欄位，match gameTableMapping 預設）
CREATE TABLE IF NOT EXISTS `accounts` (
  `login` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. characters：角色表（getMaxLevelByAccount 會讀）
CREATE TABLE IF NOT EXISTS `characters` (
  `obj_Id` INT NOT NULL AUTO_INCREMENT,
  `account_name` VARCHAR(100) NOT NULL,
  `char_name` VARCHAR(100) NOT NULL,
  `level` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`obj_Id`),
  KEY `idx_account` (`account_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 測試 seed data ──────────────────────────────────────

-- 四個事前預約階段道具
INSERT IGNORE INTO `etcitem` (`item_id`, `name`) VALUES
  (60000001, '事前預約-第一階段獎勵'),
  (60000002, '事前預約-第二階段獎勵'),
  (60000003, '事前預約-第三階段獎勵'),
  (60000004, '事前預約-第四階段獎勵'),
  (60000999, '其他道具-用於測試 ITEM_NOT_IN_GAMEDB');

-- 清乾淨測試用的寄送紀錄（每次測試前保持乾淨）
-- 注意：實測時 setup script 會 TRUNCATE
