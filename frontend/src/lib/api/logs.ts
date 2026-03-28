import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SystemLog } from '../types';

export async function getLogs(page = 1, limit = 20): Promise<PaginatedResponse<SystemLog>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<SystemLog>>>('/logs', { params: { page, limit } });
  return data.data;
}
