import type { Metadata } from 'next';
import {
  getPublicArticleBySlugSSR,
  getAdjacentArticlesSSR,
} from '@/lib/api/server';
import ArticleView from './ArticleView';

/** 以台北時區格式化，SSR 與 CSR 一致，避免 hydration error */
function formatTaipeiDateTime(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

interface PageProps {
  params: { slug: string };
}

/** 從 HTML 富文本取出純文字前 N 字當 description fallback */
function htmlToText(html: string, maxLen = 160): string {
  const stripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = await getPublicArticleBySlugSSR(params.slug);
  if (!article) {
    return {
      title: '找不到文章',
      description: '您要尋找的文章不存在或已被移除。',
      robots: { index: false, follow: false },
    };
  }
  const description = article.summary?.trim() || htmlToText(article.content);
  const images = article.coverImageUrl ? [{ url: article.coverImageUrl }] : undefined;
  return {
    title: article.title,
    description,
    openGraph: {
      type: 'article',
      title: article.title,
      description,
      images,
      publishedTime: article.publishedAt || article.createdAt,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: article.coverImageUrl ? [article.coverImageUrl] : undefined,
    },
    alternates: {
      canonical: `/public/news/${article.slug}`,
    },
  };
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const [article, adjacent] = await Promise.all([
    getPublicArticleBySlugSSR(params.slug),
    getAdjacentArticlesSSR(params.slug),
  ]);

  const jsonLd = article
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.summary || htmlToText(article.content),
        image: article.coverImageUrl || undefined,
        datePublished: article.publishedAt || article.createdAt,
        dateModified: article.updatedAt,
        author: { '@type': 'Organization', name: '始祖天堂' },
        publisher: {
          '@type': 'Organization',
          name: '始祖天堂',
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ArticleView
        article={article}
        prevArticle={adjacent?.prev ?? null}
        nextArticle={adjacent?.next ?? null}
        publishedLabel={
          article ? formatTaipeiDateTime(article.publishedAt || article.createdAt) : ''
        }
      />
    </>
  );
}
