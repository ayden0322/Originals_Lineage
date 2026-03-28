# 始祖天堂平台 — 頁面路徑與帳號資訊

## 服務端口

| 服務 | 端口 |
|------|------|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000/api |
| PostgreSQL | localhost:5432 |
| MySQL (Game DB) | localhost:3306 |
| Redis | localhost:6379 |

---

## 測試帳號

### 總後台管理員（Platform Admin）

| Email | 密碼 | 登入頁 | 說明 |
|-------|------|--------|------|
| admin@admin.com | admin123 | /admin/login | 超級管理員，擁有全部 22 項權限 |

### 模組管理員（Module Admin — 始祖天堂）

| Email | 密碼 | 登入頁 | 說明 |
|-------|------|--------|------|
| originals@gmail.com | originals123 | /originals/admin-login | 始祖天堂管理員，擁有 14 項模組權限 |

### 玩家（官網前台）

| 登入方式 | 登入頁 | 說明 |
|----------|--------|------|
| 遊戲帳號 + 密碼 | /auth/login | 可透過 `/auth/register` 自行註冊 |

---

## 頁面路徑

### 登入頁面（三個獨立頁面）

| 路徑 | 說明 |
|------|------|
| /auth/login | 玩家登入（遊戲帳號 + 密碼） |
| /auth/register | 玩家註冊 |
| /admin/login | 總後台登入（Email + 密碼） |
| /originals/admin-login | 始祖天堂管理後台登入（Email + 密碼） |

### 主後台（Platform Admin）

需以 `admin@admin.com` 登入。

| 路徑 | 說明 |
|------|------|
| /platform/dashboard | 平台儀表板（帳號數、模組數統計） |
| /platform/accounts | 帳號管理（新增 / 編輯 / 刪除） |
| /platform/accounts/[id]/permissions | 權限設定（Checkbox 勾選矩陣） |
| /platform/modules | 模組管理（開關金流 / LINE Bot） |
| /platform/logs | 系統日誌（操作記錄） |

### 模組後台（Module Admin）

需以 `originals@gmail.com` 登入。

| 路徑 | 說明 |
|------|------|
| /module/dashboard | 模組儀表板（會員 / 預約 / 訂單統計） |
| /module/members | 會員管理（綁定列表 + 狀態更新） |
| /module/content/articles | 文章管理（CRUD） |
| /module/content/announcements | 公告管理（CRUD） |
| /module/reservations | 預約管理（統計 + 列表 + CSV 匯出） |
| /module/shop/products | 商品管理（CRUD） |
| /module/shop/orders | 訂單管理（詳情 + 重試發貨） |
| /module/settings | 模組設定（遊戲 DB / 資料表對應 / 金流 / LINE Bot） |

### 官網前台（Public）

玩家或訪客可瀏覽。

| 路徑 | 說明 |
|------|------|
| /public | 首頁 Landing（預約計數 + 最新公告） |
| /public/news | 最新消息列表 |
| /public/news/[slug] | 文章詳情 |
| /public/shop | 鑽石商城（商品列表 + 購買） |
| /public/reserve | 事前預約（預約表單） |
| /public/profile | 個人中心（遊戲綁定 + 我的訂單） |

---

## 本地開發存取方式

直接使用路徑前綴：
```
http://localhost:3000/admin/login
http://localhost:3000/originals/admin-login
http://localhost:3000/auth/login
http://localhost:3000/platform/dashboard
http://localhost:3000/module/dashboard
http://localhost:3000/public
```

或使用 query param：
```
http://localhost:3000/dashboard?app=platform-admin
http://localhost:3000/dashboard?app=module-admin
http://localhost:3000/?app=public
```
