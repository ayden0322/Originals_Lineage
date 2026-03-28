import apiClient from './client';
import type { ApiResponse, PaginatedResponse, MemberBinding, WebsiteUser, SecondPasswordLog } from '../types';

// Admin
export async function getMembers(page = 1, limit = 10): Promise<PaginatedResponse<WebsiteUser>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<WebsiteUser>>>('/modules/originals/members', { params: { page, limit } });
  return data.data;
}

export async function getMember(id: string): Promise<MemberBinding> {
  const { data } = await apiClient.get<ApiResponse<MemberBinding>>(`/modules/originals/members/${id}`);
  return data.data;
}

export async function updateMemberStatus(id: string, bindingStatus: string): Promise<MemberBinding> {
  const { data } = await apiClient.patch<ApiResponse<MemberBinding>>(`/modules/originals/members/${id}/status`, { bindingStatus });
  return data.data;
}

export async function adminResetSecondPassword(
  userId: string,
  newSecondPassword: string,
): Promise<{ message: string }> {
  const { data } = await apiClient.post<ApiResponse<{ message: string }>>(
    `/modules/originals/members/${userId}/reset-second-password`,
    { newSecondPassword },
  );
  return data.data;
}

export async function getSecondPasswordLogs(
  userId: string,
): Promise<SecondPasswordLog[]> {
  const { data } = await apiClient.get<ApiResponse<SecondPasswordLog[]>>(
    `/modules/originals/members/${userId}/second-password-logs`,
  );
  return data.data;
}

// Player
export async function bindGameAccount(gameAccountName: string): Promise<MemberBinding> {
  const { data } = await apiClient.post<ApiResponse<MemberBinding>>('/public/originals/members/bind', { gameAccountName });
  return data.data;
}

export async function getMyBinding(): Promise<MemberBinding | null> {
  const { data } = await apiClient.get<ApiResponse<MemberBinding | null>>('/public/originals/members/my-binding');
  return data.data;
}
