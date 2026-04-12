import type { Article, PaginatedResponse, PublicSiteConfig } from '@/lib/types';

/**
 * SSR / generateMetadata 專用的 API fetch。
 * 瀏覽器走 NEXT_PUBLIC_API_URL（localhost:4000），
 * 但 Docker 內 SSR 要走 container 名 backend:4000，
 * 所以這裡獨立一支走 INTERNAL_API_URL，fallback 到 http://backend:4000/api。
 */
const SERVER_API_URL =
  process.env.INTERNAL_API_URL || 'http://backend:4000/api';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}${path}`, {
      // metadata fetch 不應該被 Next 快取太久，讓使用者編輯後盡快生效
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export function getPublicSiteConfigSSR() {
  return serverGet<PublicSiteConfig>('/public/originals/site/config');
}

export function getPublicArticleBySlugSSR(slug: string) {
  return serverGet<Article>(
    `/public/originals/articles/${encodeURIComponent(slug)}`,
  );
}

export function getAdjacentArticlesSSR(slug: string) {
  return serverGet<{
    prev: { title: string; slug: string; coverImageUrl: string | null } | null;
    next: { title: string; slug: string; coverImageUrl: string | null } | null;
  }>(`/public/originals/articles/${encodeURIComponent(slug)}/adjacent`);
}

export async function getAllPublishedArticleSlugsSSR(): Promise<
  { slug: string; updatedAt: string }[]
> {
  const data = await serverGet<PaginatedResponse<Article>>(
    '/public/originals/articles?page=1&limit=500',
  );
  if (!data) return [];
  return data.items
    .filter((a) => a.status === 'published')
    .map((a) => ({ slug: a.slug, updatedAt: a.updatedAt }));
}
