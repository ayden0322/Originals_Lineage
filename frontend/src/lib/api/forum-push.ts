import apiClient from './client';
import type { ApiResponse } from '../types';

// ─── Types ────────────────────────────────────────────────────────

export type ForumPushApplicationStatus = 'pending' | 'reviewed';
export type ForumPushRewardStatus = 'pending' | 'sent' | 'partial' | 'failed';
export type ForumPushItemType = 'link' | 'screenshot';
export type ForumPushItemReviewResult = 'pending' | 'passed' | 'rejected';
export type DuplicateUrlPolicy = 'warn' | 'block';

export interface ForumPushItem {
  id: string;
  applicationId: string;
  sortOrder: number;
  type: ForumPushItemType;
  content: string;
  normalizedUrl: string | null;
  reviewResult: ForumPushItemReviewResult;
  createdAt: string;
}

export interface ForumPushItemWithDuplicates extends ForumPushItem {
  duplicates?: Array<{
    applicationId: string;
    createdAt: string;
    reviewResult: ForumPushItemReviewResult;
  }>;
}

export interface ForumPushApplication {
  id: string;
  websiteUserId: string;
  gameAccount: string;
  gameCharacter: string | null;
  fbName: string;
  fbLink: string;
  status: ForumPushApplicationStatus;
  passedCount: number;
  rewardStatus: ForumPushRewardStatus;
  rewardPayload: Array<{
    itemCode: number;
    itemName: string;
    quantity: number;
    insertId?: number;
    error?: string;
  }> | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyApplication extends ForumPushApplication {
  items: ForumPushItem[];
}

export interface ForumPushRewardConfig {
  id: string;
  itemCode: number;
  itemName: string;
  quantityPerPass: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ForumPushSettings {
  id: string;
  maxApplicationsPerDay: number;
  maxItemsPerApplication: number;
  duplicateUrlPolicy: DuplicateUrlPolicy;
  pageDescription: string | null;
  updatedAt: string;
}

export interface PublicStatus {
  settings: {
    maxApplicationsPerDay: number;
    maxItemsPerApplication: number;
    duplicateUrlPolicy: DuplicateUrlPolicy;
    pageDescription: string | null;
  };
  todayUsed: number;
  remainingToday: number;
  gameAccount: string | null;
  gameCharacters: string[];
  lastFbName: string | null;
  lastFbLink: string | null;
}

export interface ApplicationListResponse {
  data: ForumPushApplication[];
  total: number;
  page: number;
  limit: number;
}

// ─── Public（會員中心） ─────────────────────────────────────────

export async function getPublicStatus(): Promise<PublicStatus> {
  const { data } = await apiClient.get<ApiResponse<PublicStatus>>(
    '/public/originals/forum-push/status',
  );
  return data.data;
}

export async function getMyApplications(): Promise<MyApplication[]> {
  const { data } = await apiClient.get<ApiResponse<MyApplication[]>>(
    '/public/originals/forum-push/my-applications',
  );
  return data.data;
}

export async function submitApplication(dto: {
  gameCharacter?: string;
  fbName: string;
  fbLink: string;
  items: Array<{ type: 'link' | 'screenshot'; content: string }>;
}): Promise<ForumPushApplication> {
  const { data } = await apiClient.post<ApiResponse<ForumPushApplication>>(
    '/public/originals/forum-push/applications',
    dto,
  );
  return data.data;
}

export async function uploadScreenshot(
  file: File,
): Promise<{ objectName: string; url: string }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<
    ApiResponse<{ objectName: string; url: string }>
  >('/public/originals/forum-push/upload-screenshot', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

// ─── Admin（模組後台） ──────────────────────────────────────────

export async function getApplications(params: {
  page?: number;
  limit?: number;
  status?: string;
  keyword?: string;
  from?: string;
  to?: string;
}): Promise<ApplicationListResponse> {
  const { data } = await apiClient.get<ApiResponse<ApplicationListResponse>>(
    '/modules/originals/forum-push',
    { params },
  );
  return data.data;
}

export async function getApplicationDetail(
  id: string,
): Promise<{
  application: ForumPushApplication;
  items: ForumPushItemWithDuplicates[];
}> {
  const { data } = await apiClient.get<
    ApiResponse<{
      application: ForumPushApplication;
      items: ForumPushItemWithDuplicates[];
    }>
  >(`/modules/originals/forum-push/${id}`);
  return data.data;
}

export async function reviewApplication(
  id: string,
  dto: {
    items: Array<{ itemId: string; result: 'passed' | 'rejected' }>;
    reviewNote?: string;
  },
): Promise<{
  application: ForumPushApplication;
  rewardDelivery: ForumPushApplication['rewardPayload'];
}> {
  const { data } = await apiClient.patch<
    ApiResponse<{
      application: ForumPushApplication;
      rewardDelivery: ForumPushApplication['rewardPayload'];
    }>
  >(`/modules/originals/forum-push/${id}/review`, dto);
  return data.data;
}

export async function deleteApplication(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/forum-push/${id}`);
}

// 遊戲道具搜尋（供獎勵設定下拉使用）

export interface GameItemOption {
  itemId: number;
  name: string;
}

export async function searchGameItems(
  search?: string,
  page = 1,
  limit = 20,
): Promise<{ items: GameItemOption[]; total: number }> {
  const { data } = await apiClient.get<
    ApiResponse<{ items: GameItemOption[]; total: number }>
  >('/modules/originals/forum-push/config/game-items', {
    params: { search, page, limit },
  });
  return data.data;
}

// 獎勵道具設定

export async function getRewardConfigs(): Promise<ForumPushRewardConfig[]> {
  const { data } = await apiClient.get<ApiResponse<ForumPushRewardConfig[]>>(
    '/modules/originals/forum-push/config/reward-configs',
  );
  return data.data;
}

export async function createRewardConfig(dto: {
  itemCode: number;
  itemName: string;
  quantityPerPass: number;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ForumPushRewardConfig> {
  const { data } = await apiClient.post<ApiResponse<ForumPushRewardConfig>>(
    '/modules/originals/forum-push/config/reward-configs',
    dto,
  );
  return data.data;
}

export async function updateRewardConfig(
  id: string,
  dto: Partial<{
    itemCode: number;
    itemName: string;
    quantityPerPass: number;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<ForumPushRewardConfig> {
  const { data } = await apiClient.patch<ApiResponse<ForumPushRewardConfig>>(
    `/modules/originals/forum-push/config/reward-configs/${id}`,
    dto,
  );
  return data.data;
}

export async function deleteRewardConfig(id: string): Promise<void> {
  await apiClient.delete(
    `/modules/originals/forum-push/config/reward-configs/${id}`,
  );
}

// 全域設定

export async function getSettings(): Promise<ForumPushSettings> {
  const { data } = await apiClient.get<ApiResponse<ForumPushSettings>>(
    '/modules/originals/forum-push/config/settings',
  );
  return data.data;
}

export async function updateSettings(dto: {
  maxApplicationsPerDay?: number;
  maxItemsPerApplication?: number;
  duplicateUrlPolicy?: DuplicateUrlPolicy;
  pageDescription?: string;
}): Promise<ForumPushSettings> {
  const { data } = await apiClient.patch<ApiResponse<ForumPushSettings>>(
    '/modules/originals/forum-push/config/settings',
    dto,
  );
  return data.data;
}
