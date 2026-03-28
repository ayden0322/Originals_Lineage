import apiClient from './client';
import type { ApiResponse, Permission } from '../types';

export async function getAllPermissions(): Promise<Permission[]> {
  const { data } = await apiClient.get<ApiResponse<Permission[]>>('/permissions');
  return data.data;
}

export async function getAccountPermissions(accountId: string): Promise<Permission[]> {
  const { data } = await apiClient.get<ApiResponse<Permission[]>>(`/permissions/by-account/${accountId}`);
  return data.data;
}

export async function assignPermissions(accountId: string, permissionIds: string[]): Promise<void> {
  await apiClient.post('/permissions/assign', { accountId, permissionIds });
}

export async function revokePermissions(accountId: string, permissionIds: string[]): Promise<void> {
  await apiClient.delete('/permissions/revoke', { data: { accountId, permissionIds } });
}
