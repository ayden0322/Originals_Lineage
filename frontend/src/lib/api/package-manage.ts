import apiClient from './client';
import type {
  ApiResponse,
  GamePackage,
  PackageSettings,
  PublicPackageConfig,
} from '../types';

// ─── Admin - Packages CRUD ───────────────────────────────────────────

export async function getPackages(): Promise<GamePackage[]> {
  const { data } = await apiClient.get<ApiResponse<GamePackage[]>>(
    '/modules/originals/package-manage/packages',
  );
  return data.data;
}

export async function createPackage(
  dto: Partial<GamePackage>,
): Promise<GamePackage> {
  const { data } = await apiClient.post<ApiResponse<GamePackage>>(
    '/modules/originals/package-manage/packages',
    dto,
  );
  return data.data;
}

export async function updatePackage(
  id: string,
  dto: Partial<GamePackage>,
): Promise<GamePackage> {
  const { data } = await apiClient.patch<ApiResponse<GamePackage>>(
    `/modules/originals/package-manage/packages/${id}`,
    dto,
  );
  return data.data;
}

export async function deletePackage(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/package-manage/packages/${id}`);
}

export async function reorderPackages(
  items: { id: string; sortOrder: number }[],
): Promise<GamePackage[]> {
  const { data } = await apiClient.put<ApiResponse<GamePackage[]>>(
    '/modules/originals/package-manage/packages/reorder',
    { items },
  );
  return data.data;
}

// ─── Admin - Settings ───────────────────────────────────────────────

export async function getPackageSettings(): Promise<PackageSettings> {
  const { data } = await apiClient.get<ApiResponse<PackageSettings>>(
    '/modules/originals/package-manage/settings',
  );
  return data.data;
}

export async function updatePackageSettings(
  dto: Partial<PackageSettings>,
): Promise<PackageSettings> {
  const { data } = await apiClient.put<ApiResponse<PackageSettings>>(
    '/modules/originals/package-manage/settings',
    dto,
  );
  return data.data;
}

// ─── Public ─────────────────────────────────────────────────────────

export async function getPublicPackageConfig(): Promise<PublicPackageConfig> {
  const { data } = await apiClient.get<ApiResponse<PublicPackageConfig>>(
    '/public/originals/packages/config',
  );
  return data.data;
}
