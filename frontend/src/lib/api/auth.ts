import apiClient from './client';
import type {
  ApiResponse,
  TokenPair,
  AuthUser,
  CheckGameAccountResult,
  PlayerProfile,
  ChangeSecondPasswordDto,
} from '../types';

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await apiClient.post<ApiResponse<TokenPair>>('/auth/login', { email, password });
  return data.data;
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
  return data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function refreshToken(): Promise<TokenPair> {
  const { data } = await apiClient.post<ApiResponse<TokenPair>>('/auth/refresh');
  return data.data;
}

// Player auth
export async function playerRegister(dto: {
  gameAccountName: string;
  password: string;
  secondPassword: string;
  refCode?: string;
}): Promise<unknown> {
  const { data } = await apiClient.post<ApiResponse<unknown>>('/public/originals/auth/register', dto);
  return data.data;
}

export async function playerLogin(gameAccountName: string, password: string): Promise<TokenPair> {
  const { data } = await apiClient.post<ApiResponse<TokenPair>>('/public/originals/auth/login', { gameAccountName, password });
  return data.data;
}

export async function checkGameAccount(gameAccountName: string): Promise<CheckGameAccountResult> {
  const { data } = await apiClient.post<ApiResponse<CheckGameAccountResult>>(
    '/public/originals/auth/check-game-account',
    { gameAccountName },
  );
  return data.data;
}

export async function getPlayerProfile(): Promise<PlayerProfile> {
  const { data } = await apiClient.get<ApiResponse<PlayerProfile>>(
    '/public/originals/auth/profile',
  );
  return data.data;
}

export async function changePassword(dto: {
  secondPassword: string;
  newPassword: string;
}): Promise<{ message: string }> {
  const { data } = await apiClient.post<ApiResponse<{ message: string }>>(
    '/public/originals/auth/change-password',
    dto,
  );
  return data.data;
}

export async function changeSecondPassword(
  dto: ChangeSecondPasswordDto,
): Promise<{ message: string }> {
  const { data } = await apiClient.post<ApiResponse<{ message: string }>>(
    '/public/originals/auth/change-second-password',
    dto,
  );
  return data.data;
}

// Module admin auth (統一使用 /auth 端點)
export async function moduleAdminLogin(email: string, password: string): Promise<TokenPair> {
  const { data } = await apiClient.post<ApiResponse<TokenPair>>(
    '/auth/module-login',
    { email, password },
  );
  return data.data;
}

export async function getModuleAdminMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
  return data.data;
}

export async function moduleAdminLogout(): Promise<void> {
  await apiClient.post('/auth/logout');
}
