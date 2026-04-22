import apiClient from './client';
import type { ApiResponse, PaginatedResponse, Account, CreateAccountDto, UpdateAccountDto } from '../types';

export async function getAccounts(page = 1, limit = 10): Promise<PaginatedResponse<Account>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Account>>>('/accounts', { params: { page, limit } });
  return data.data;
}

export async function getAccount(id: string): Promise<Account> {
  const { data } = await apiClient.get<ApiResponse<Account>>(`/accounts/${id}`);
  return data.data;
}

export async function createAccount(dto: CreateAccountDto): Promise<Account> {
  const { data } = await apiClient.post<ApiResponse<Account>>('/accounts', dto);
  return data.data;
}

export async function updateAccount(id: string, dto: UpdateAccountDto): Promise<Account> {
  const { data } = await apiClient.patch<ApiResponse<Account>>(`/accounts/${id}`, dto);
  return data.data;
}

export async function deleteAccount(id: string): Promise<void> {
  await apiClient.delete(`/accounts/${id}`);
}

export async function resetAccountPassword(id: string, password: string): Promise<Account> {
  const { data } = await apiClient.patch<ApiResponse<Account>>(`/accounts/${id}/password`, { password });
  return data.data;
}
