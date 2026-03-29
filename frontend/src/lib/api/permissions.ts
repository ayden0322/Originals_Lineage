import apiClient from './client';
import type { ApiResponse, Permission } from '../types';

export async function getAllPermissions(): Promise<Permission[]> {
  const { data } = await apiClient.get<ApiResponse<Permission[]>>('/permissions');
  return data.data;
}

/** 取得某帳號已被指派的權限 codes */
export async function getAccountPermissionCodes(accountId: string): Promise<string[]> {
  const { data } = await apiClient.get<ApiResponse<string[]>>(`/permissions/by-account/${accountId}`);
  return data.data;
}

export async function assignPermissions(accountId: string, permissionCodes: string[]): Promise<void> {
  await apiClient.post('/permissions/assign', { accountId, permissionCodes });
}

export async function revokePermissions(accountId: string, permissionCodes: string[]): Promise<void> {
  await apiClient.delete('/permissions/revoke', { data: { accountId, permissionCodes } });
}
