import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/public', '/public/news', '/public/shop', '/public/packages', '/public/reserve', '/public/support', '/public/changelog', '/public/events'],
        disallow: [
          '/admin',
          '/platform',
          '/module',
          '/originals',
          '/auth',
          '/api',
          '/dashboard',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
