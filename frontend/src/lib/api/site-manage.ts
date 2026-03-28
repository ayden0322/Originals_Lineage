import apiClient from './client';
import type {
  ApiResponse,
  SiteSettings,
  SiteSection,
  CarouselSlide,
  PublicSiteConfig,
} from '../types';

// ─── Site Settings ──────────────────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data } = await apiClient.get<ApiResponse<SiteSettings>>(
    '/modules/originals/site-manage/settings',
  );
  return data.data;
}

export async function updateSiteSettings(
  dto: Partial<SiteSettings>,
): Promise<SiteSettings> {
  const { data } = await apiClient.put<ApiResponse<SiteSettings>>(
    '/modules/originals/site-manage/settings',
    dto,
  );
  return data.data;
}

// ─── Sections ───────────────────────────────────────────────────────

export async function getSections(): Promise<SiteSection[]> {
  const { data } = await apiClient.get<ApiResponse<SiteSection[]>>(
    '/modules/originals/site-manage/sections',
  );
  return data.data;
}

export async function createSection(
  dto: Partial<SiteSection>,
): Promise<SiteSection> {
  const { data } = await apiClient.post<ApiResponse<SiteSection>>(
    '/modules/originals/site-manage/sections',
    dto,
  );
  return data.data;
}

export async function updateSection(
  id: string,
  dto: Partial<SiteSection>,
): Promise<SiteSection> {
  const { data } = await apiClient.patch<ApiResponse<SiteSection>>(
    `/modules/originals/site-manage/sections/${id}`,
    dto,
  );
  return data.data;
}

export async function deleteSection(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/site-manage/sections/${id}`);
}

export async function reorderSections(
  items: { id: string; sortOrder: number }[],
): Promise<SiteSection[]> {
  const { data } = await apiClient.put<ApiResponse<SiteSection[]>>(
    '/modules/originals/site-manage/sections/reorder',
    { items },
  );
  return data.data;
}

// ─── Section Slides ─────────────────────────────────────────────────

export async function getSectionSlides(
  sectionId: string,
): Promise<CarouselSlide[]> {
  const { data } = await apiClient.get<ApiResponse<CarouselSlide[]>>(
    `/modules/originals/site-manage/sections/${sectionId}/slides`,
  );
  return data.data;
}

export async function createSectionSlide(
  sectionId: string,
  dto: Partial<CarouselSlide>,
): Promise<CarouselSlide> {
  const { data } = await apiClient.post<ApiResponse<CarouselSlide>>(
    `/modules/originals/site-manage/sections/${sectionId}/slides`,
    dto,
  );
  return data.data;
}

// ─── Hero Slides ────────────────────────────────────────────────────

export async function getHeroSlides(): Promise<CarouselSlide[]> {
  const { data } = await apiClient.get<ApiResponse<CarouselSlide[]>>(
    '/modules/originals/site-manage/hero-slides',
  );
  return data.data;
}

export async function createHeroSlide(
  dto: Partial<CarouselSlide>,
): Promise<CarouselSlide> {
  const { data } = await apiClient.post<ApiResponse<CarouselSlide>>(
    '/modules/originals/site-manage/hero-slides',
    dto,
  );
  return data.data;
}

// ─── Shared Slide Operations ────────────────────────────────────────

export async function updateSlide(
  id: string,
  dto: Partial<CarouselSlide>,
): Promise<CarouselSlide> {
  const { data } = await apiClient.patch<ApiResponse<CarouselSlide>>(
    `/modules/originals/site-manage/slides/${id}`,
    dto,
  );
  return data.data;
}

export async function deleteSlide(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/site-manage/slides/${id}`);
}

export async function reorderSlides(
  items: { id: string; sortOrder: number }[],
): Promise<void> {
  await apiClient.put('/modules/originals/site-manage/slides/reorder', {
    items,
  });
}

// ─── File Upload ────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  folder = 'general',
): Promise<{ url: string; objectName: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const { data } = await apiClient.post<
    ApiResponse<{ url: string; objectName: string }>
  >('/modules/originals/storage/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

// ─── Public ─────────────────────────────────────────────────────────

export async function getPublicSiteConfig(): Promise<PublicSiteConfig> {
  const { data } = await apiClient.get<ApiResponse<PublicSiteConfig>>(
    '/public/originals/site/config',
  );
  return data.data;
}
