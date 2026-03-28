import apiClient from './client';
import type { ApiResponse, PaginatedResponse, Article, Announcement, CreateArticleDto, CreateAnnouncementDto, ArticleCategory } from '../types';

// Admin - Articles
export async function getArticles(page = 1, limit = 10): Promise<PaginatedResponse<Article>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Article>>>('/modules/originals/articles', { params: { page, limit } });
  return data.data;
}

export async function getArticle(id: string): Promise<Article> {
  const { data } = await apiClient.get<ApiResponse<Article>>(`/modules/originals/articles/${id}`);
  return data.data;
}

export async function createArticle(dto: CreateArticleDto): Promise<Article> {
  const { data } = await apiClient.post<ApiResponse<Article>>('/modules/originals/articles', dto);
  return data.data;
}

export async function updateArticle(id: string, dto: Partial<CreateArticleDto>): Promise<Article> {
  const { data } = await apiClient.patch<ApiResponse<Article>>(`/modules/originals/articles/${id}`, dto);
  return data.data;
}

export async function deleteArticle(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/articles/${id}`);
}

// Admin - Categories
export async function getCategories(): Promise<ArticleCategory[]> {
  const { data } = await apiClient.get<ApiResponse<ArticleCategory[]>>('/modules/originals/categories');
  return data.data;
}

export async function createCategory(dto: Partial<ArticleCategory>): Promise<ArticleCategory> {
  const { data } = await apiClient.post<ApiResponse<ArticleCategory>>('/modules/originals/categories', dto);
  return data.data;
}

export async function updateCategory(id: string, dto: Partial<ArticleCategory>): Promise<ArticleCategory> {
  const { data } = await apiClient.patch<ApiResponse<ArticleCategory>>(`/modules/originals/categories/${id}`, dto);
  return data.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/categories/${id}`);
}

// Admin - Announcements
export async function getAnnouncements(page = 1, limit = 10): Promise<PaginatedResponse<Announcement>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Announcement>>>('/modules/originals/announcements', { params: { page, limit } });
  return data.data;
}

export async function createAnnouncement(dto: CreateAnnouncementDto): Promise<Announcement> {
  const { data } = await apiClient.post<ApiResponse<Announcement>>('/modules/originals/announcements', dto);
  return data.data;
}

export async function updateAnnouncement(id: string, dto: Partial<CreateAnnouncementDto>): Promise<Announcement> {
  const { data } = await apiClient.patch<ApiResponse<Announcement>>(`/modules/originals/announcements/${id}`, dto);
  return data.data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/announcements/${id}`);
}

// Public
export async function getPublicArticles(page = 1, limit = 10, category?: string): Promise<PaginatedResponse<Article>> {
  const params: Record<string, unknown> = { page, limit };
  if (category) params.category = category;
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Article>>>('/public/originals/articles', { params });
  return data.data;
}

export async function getPublicArticleBySlug(slug: string): Promise<Article> {
  const { data } = await apiClient.get<ApiResponse<Article>>(`/public/originals/articles/${slug}`);
  return data.data;
}

export async function getAdjacentArticles(slug: string): Promise<{
  prev: { title: string; slug: string; coverImageUrl: string | null } | null;
  next: { title: string; slug: string; coverImageUrl: string | null } | null;
}> {
  const { data } = await apiClient.get<ApiResponse<{
    prev: { title: string; slug: string; coverImageUrl: string | null } | null;
    next: { title: string; slug: string; coverImageUrl: string | null } | null;
  }>>(`/public/originals/articles/${slug}/adjacent`);
  return data.data;
}

export async function getPublicCategories(): Promise<ArticleCategory[]> {
  const { data } = await apiClient.get<ApiResponse<ArticleCategory[]>>('/public/originals/categories');
  return data.data;
}

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await apiClient.get<ApiResponse<Announcement[]>>('/public/originals/announcements/active');
  return data.data;
}
