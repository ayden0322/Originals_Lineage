import apiClient from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  ReservationMilestone,
  RewardClaim,
  RewardClaimStatus,
  MilestoneDistribution,
  MyReward,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────

export interface ReservationPageSettings {
  pageTitle: string;
  pageSubtitle: string | null;
  pageDescription: string | null;
  countBase: number;
  deadlineAt: string | null;
  isDistributionLocked: boolean;
  heroBackgroundUrl: string | null;
  heroOverlayOpacity: number;
}

export interface ReserveStatusResponse {
  displayCount: number;
  milestones: ReservationMilestone[];
  pageSettings: ReservationPageSettings;
  myReservation: {
    reserved: boolean;
    createdAt?: string;
    gameAccountName?: string;
  };
}

export interface ReservationRecord {
  id: string;
  websiteUserId: string;
  gameAccountName: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface ReservationStats {
  actualCount: number;
  countBase: number;
  displayCount: number;
}

// ─── Public ────────────────────────────────────────────────────────

export async function getReserveStatus(): Promise<ReserveStatusResponse> {
  const { data } = await apiClient.get<ApiResponse<ReserveStatusResponse>>(
    '/public/originals/reserve/status',
  );
  return data.data;
}

export async function createReservation(): Promise<ReservationRecord> {
  const { data } = await apiClient.post<ApiResponse<ReservationRecord>>(
    '/public/originals/reserve',
  );
  return data.data;
}

// ─── Admin: 預約管理 ──────────────────────────────────────────────

export async function getReservations(
  page = 1,
  limit = 10,
  keyword?: string,
): Promise<PaginatedResponse<ReservationRecord>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<ReservationRecord>>>(
    '/modules/originals/reservations',
    { params: { page, limit, keyword } },
  );
  return data.data;
}

export async function getReservationStats(): Promise<ReservationStats> {
  const { data } = await apiClient.get<ApiResponse<ReservationStats>>(
    '/modules/originals/reservations/stats',
  );
  return data.data;
}

export async function exportReservations(): Promise<Blob> {
  const response = await apiClient.post(
    '/modules/originals/reservations/export',
    {},
    { responseType: 'blob' },
  );
  return response.data;
}

// ─── Admin: 頁面設定 ─────────────────────────────────────────────

export async function getPageSettings(): Promise<ReservationPageSettings> {
  const { data } = await apiClient.get<ApiResponse<ReservationPageSettings>>(
    '/modules/originals/reservations/page-settings',
  );
  return data.data;
}

export async function updatePageSettings(
  dto: Partial<ReservationPageSettings>,
): Promise<ReservationPageSettings> {
  const { data } = await apiClient.patch<ApiResponse<ReservationPageSettings>>(
    '/modules/originals/reservations/page-settings',
    dto,
  );
  return data.data;
}

// ─── Admin: 里程碑管理 ────────────────────────────────────────────

export async function getMilestones(): Promise<ReservationMilestone[]> {
  const { data } = await apiClient.get<ApiResponse<ReservationMilestone[]>>(
    '/modules/originals/reservations/milestones',
  );
  return data.data;
}

export async function createMilestone(dto: {
  threshold: number;
  rewardName: string;
  rewardDescription?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ReservationMilestone> {
  const { data } = await apiClient.post<ApiResponse<ReservationMilestone>>(
    '/modules/originals/reservations/milestones',
    dto,
  );
  return data.data;
}

export async function updateMilestone(
  id: string,
  dto: Partial<{
    threshold: number;
    rewardName: string;
    rewardDescription: string;
    imageUrl: string;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<ReservationMilestone> {
  const { data } = await apiClient.patch<ApiResponse<ReservationMilestone>>(
    `/modules/originals/reservations/milestones/${id}`,
    dto,
  );
  return data.data;
}

export async function deleteMilestone(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/reservations/milestones/${id}`);
}

// ─── Admin: 發獎批次 ─────────────────────────────────────────────

export async function distributeMilestone(
  milestoneId: string,
): Promise<{ created: number; skipped: number; totalReservations: number }> {
  const { data } = await apiClient.post<
    ApiResponse<{ created: number; skipped: number; totalReservations: number }>
  >(`/modules/originals/reservations/milestones/${milestoneId}/distribute`);
  return data.data;
}

export async function getDistributionSummary(): Promise<MilestoneDistribution[]> {
  const { data } = await apiClient.get<ApiResponse<MilestoneDistribution[]>>(
    '/modules/originals/reservations/distributions',
  );
  return data.data;
}

export async function getClaimsByMilestone(
  milestoneId: string,
  params: { status?: RewardClaimStatus; page?: number; limit?: number } = {},
): Promise<PaginatedResponse<RewardClaim>> {
  const { data } = await apiClient.get<
    ApiResponse<PaginatedResponse<RewardClaim>>
  >(`/modules/originals/reservations/milestones/${milestoneId}/claims`, {
    params,
  });
  return data.data;
}

export async function markClaimsStatus(dto: {
  claimIds: string[];
  status: RewardClaimStatus;
  note?: string;
}): Promise<{ updated: number }> {
  const { data } = await apiClient.patch<ApiResponse<{ updated: number }>>(
    '/modules/originals/reservations/claims/status',
    dto,
  );
  return data.data;
}

// ─── Public: 使用者獎勵 ──────────────────────────────────────────

export async function getMyRewards(): Promise<MyReward[]> {
  const { data } = await apiClient.get<ApiResponse<MyReward[]>>(
    '/public/originals/reserve/my-rewards',
  );
  return data.data;
}
