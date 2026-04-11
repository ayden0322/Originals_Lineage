# 始祖天堂（Originals Lineage）專案 CLAUDE.md

## 開發原則

### 權限相關的 UX 規則（必遵守）

- 前端頁面在呼叫 API 之前，**必須先檢查使用者是否有對應權限**（用 `hasPermission()` 或檢查 `user.permissions`）
- 沒有權限的 API **不要發出去**，避免 403 錯誤和錯誤提示訊息造成使用者困惑
- Dashboard、列表頁、總覽頁等會同時打多個 API 的頁面**特別重要**
- 沒權限的區塊直接不顯示，或顯示友善提示，不要讓使用者看到錯誤訊息
- 修改完之後要自己驗證不同權限組合下的顯示狀態，確認不會有 403 或錯誤畫面
- **核心觀念**：使用者不該看到「因為權限不足而產生的錯誤畫面」

### 一般開發原則

- 修改檔案後要跑 TypeScript 編譯驗證（`tsc --noEmit`）
- 前後端都要驗證
- 保持現有程式碼風格與結構

## 專案架構

- **後端**：NestJS + TypeORM（PostgreSQL 主庫 + MySQL 遊戲庫）
- **前端**：Next.js 14 App Router + Ant Design
- **認證**：統一 JWT 認證，`/auth/login`（主後台）、`/auth/module-login`（模組後台）
- **權限**：Permission + AccountPermission 表，按 `backendLevel`（platform / module）區分

## 帳號系統

- 統一使用 `accounts` 表，`backendLevel` 區分 platform / module
- 主後台：`/admin/login` → `POST /auth/login`
- 模組後台：`/originals/admin-login` → `POST /auth/module-login`
- Seed 帳號：
  - 主後台：`admin@admin.com` / `admin123`（platform，全權限）
  - 模組後台：`originals@gmail.com` / `originals123`（module，全模組權限）

## 記憶檔案

詳細設計決策和踩坑紀錄存在 `memory/` 目錄，索引見 `MEMORY.md`
