import apiClient from './client';
import type { ApiResponse, ShopSettings, PublicShopConfig } from '../types';

// ─── Admin ──────────────────────────────────────────────────────────

export async function getShopSettings(): Promise<ShopSettings> {
  const { data } = await apiClient.get<ApiResponse<ShopSettings>>(
    '/modules/originals/shop-manage/settings',
  );
  return data.data;
}

export async function updateShopSettings(
  dto: Partial<ShopSettings>,
): Promise<ShopSettings> {
  const { data } = await apiClient.put<ApiResponse<ShopSettings>>(
    '/modules/originals/shop-manage/settings',
    dto,
  );
  return data.data;
}

// ─── Public ─────────────────────────────────────────────────────────

export async function getPublicShopConfig(): Promise<PublicShopConfig> {
  const { data } = await apiClient.get<ApiResponse<PublicShopConfig>>(
    '/public/originals/shop/config',
  );
  return data.data;
}
