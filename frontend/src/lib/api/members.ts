import apiClient from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  MemberBinding,
  WebsiteUser,
  SecondPasswordLog,
  MemberOrderList,
} from '../types';

// Admin
export interface GetMembersParams {
  page?: number;
  limit?: number;
  keyword?: string;
  isActive?: boolean;
  registeredFrom?: string;
  registeredTo?: string;
}

export async function getMembers(
  params: GetMembersParams = {},
): Promise<PaginatedResponse<WebsiteUser>> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.keyword) query.keyword = params.keyword;
  if (params.isActive !== undefined) query.isActive = String(params.isActive);
  if (params.registeredFrom) query.registeredFrom = params.registeredFrom;
  if (params.registeredTo) query.registeredTo = params.registeredTo;

  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<WebsiteUser>>>(
    '/modules/originals/members',
    { params: query },
  );
  return data.data;
}

export interface GetMemberOrdersParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  status?: string;
}

export async function getMemberOrders(
  userId: string,
  params: GetMemberOrdersParams = {},
): Promise<MemberOrderList> {
  const { data } = await apiClient.get<ApiResponse<MemberOrderList>>(
    `/modules/originals/members/${userId}/orders`,
    { params },
  );
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
