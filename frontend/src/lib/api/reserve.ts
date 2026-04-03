import apiClient from './client';
import type { ApiResponse, PaginatedResponse, Reservation, ReservationMilestone, ReservationStats } from '../types';

// ─── Public ────────────────────────────────────────────────────────

export async function createReservation(dto: {
  email: string;
  displayName?: string;
  phone?: string;
  lineId?: string;
}): Promise<Reservation> {
  const { data } = await apiClient.post<ApiResponse<Reservation>>('/public/originals/reserve', dto);
  return data.data;
}

export async function getReservationCount(): Promise<number> {
  const { data } = await apiClient.get<ApiResponse<{ count: number }>>('/public/originals/reserve/count');
  return data.data.count;
}

export async function getPublicMilestones(): Promise<ReservationMilestone[]> {
  const { data } = await apiClient.get<ApiResponse<ReservationMilestone[]>>('/public/originals/reserve/milestones');
  return data.data;
}

export async function verifyReservationEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>('/public/originals/reserve/verify', { email, code });
  return data.data;
}

export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>('/public/originals/reserve/resend', { email });
  return data.data;
}

// ─── Admin: 預約管理 ──────────────────────────────────────────────

export async function getReservations(page = 1, limit = 10, status?: string): Promise<PaginatedResponse<Reservation>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Reservation>>>('/modules/originals/reservations', { params: { page, limit, status } });
  return data.data;
}

export async function getReservationStats(): Promise<ReservationStats> {
  const { data } = await apiClient.get<ApiResponse<ReservationStats>>('/modules/originals/reservations/stats');
  return data.data;
}

export async function updateReservationStatus(id: string, status: string): Promise<Reservation> {
  const { data } = await apiClient.patch<ApiResponse<Reservation>>(`/modules/originals/reservations/${id}/status`, { status });
  return data.data;
}

export async function exportReservations(): Promise<Blob> {
  const response = await apiClient.post('/modules/originals/reservations/export', {}, { responseType: 'blob' });
  return response.data;
}

// ─── Admin: 里程碑管理 ────────────────────────────────────────────

export async function getMilestones(): Promise<ReservationMilestone[]> {
  const { data } = await apiClient.get<ApiResponse<ReservationMilestone[]>>('/modules/originals/reservations/milestones');
  return data.data;
}

export async function createMilestone(dto: {
  threshold: number;
  rewardName: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ReservationMilestone> {
  const { data } = await apiClient.post<ApiResponse<ReservationMilestone>>('/modules/originals/reservations/milestones', dto);
  return data.data;
}

export async function updateMilestone(id: string, dto: Partial<{
  threshold: number;
  rewardName: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}>): Promise<ReservationMilestone> {
  const { data } = await apiClient.patch<ApiResponse<ReservationMilestone>>(`/modules/originals/reservations/milestones/${id}`, dto);
  return data.data;
}

export async function deleteMilestone(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/reservations/milestones/${id}`);
}
