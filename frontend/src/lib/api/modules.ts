import apiClient from './client';
import type { ApiResponse, ModuleConfig } from '../types';

export async function getModules(): Promise<ModuleConfig[]> {
  const { data } = await apiClient.get<ApiResponse<ModuleConfig[]>>('/modules');
  return data.data;
}

export async function updateModule(code: string, dto: Partial<ModuleConfig>): Promise<ModuleConfig> {
  const { data } = await apiClient.patch<ApiResponse<ModuleConfig>>(`/modules/${code}`, dto);
  return data.data;
}

export async function togglePayment(code: string): Promise<ModuleConfig> {
  const { data } = await apiClient.post<ApiResponse<ModuleConfig>>(`/modules/${code}/toggle-payment`);
  return data.data;
}

export async function toggleLineBot(code: string): Promise<ModuleConfig> {
  const { data } = await apiClient.post<ApiResponse<ModuleConfig>>(`/modules/${code}/toggle-line`);
  return data.data;
}
