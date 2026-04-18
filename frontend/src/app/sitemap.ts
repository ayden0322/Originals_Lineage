import type { MetadataRoute } from 'next';
import { getAllPublishedArticleSlugsSSR } from '@/lib/api/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/public`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/public/news`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/public/shop`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/public/packages`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/public/reserve`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/public/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/public/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const articles = await getAllPublishedArticleSlugsSSR();
  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${base}/public/news/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}
