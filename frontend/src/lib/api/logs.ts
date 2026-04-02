import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SystemLog } from '../types';

export interface LogQueryParams {
  page?: number;
  limit?: number;
  ipAddress?: string;
  action?: string;
  resourceType?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}

/** 平台層級 — 查詢所有日誌 */
export async function getLogs(params: LogQueryParams = {}): Promise<PaginatedResponse<SystemLog>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<SystemLog>>>('/logs', { params });
  return data.data;
}

/** 模組層級 — 查詢始祖天堂操作日誌 */
export async function getModuleLogs(params: LogQueryParams = {}): Promise<PaginatedResponse<SystemLog>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<SystemLog>>>('/modules/originals/logs', { params });
  return data.data;
}
