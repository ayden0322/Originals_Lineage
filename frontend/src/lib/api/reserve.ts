import apiClient from './client';
import type { ApiResponse, PaginatedResponse, Reservation, ReservationStats } from '../types';

// Public
export async function createReservation(dto: {
  email: string;
  displayName: string;
  phone?: string;
  lineId?: string;
  referralCode?: string;
}): Promise<Reservation> {
  const { data } = await apiClient.post<ApiResponse<Reservation>>('/public/originals/reserve', dto);
  return data.data;
}

export async function getReservationCount(): Promise<number> {
  const { data } = await apiClient.get<ApiResponse<{ count: number }>>('/public/originals/reserve/count');
  return data.data.count;
}

// Admin
export async function getReservations(page = 1, limit = 10): Promise<PaginatedResponse<Reservation>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Reservation>>>('/modules/originals/reservations', { params: { page, limit } });
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
