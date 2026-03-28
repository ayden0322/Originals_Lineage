'use client';

import { useRouter } from 'next/navigation';
import type { Article } from '@/lib/types';
import styles from '@/app/public/styles/public.module.css';
import dayjs from 'dayjs';

interface NewsPreviewProps {
  articles: Article[];
}

const categoryLabelMap: Record<string, string> = {
  news: 'NEWS',
  guide: 'GUIDE',
  update: 'UPDATE',
  event: 'EVENT',
};

export default function NewsPreview({ articles }: NewsPreviewProps) {
  const router = useRouter();

  if (articles.length === 0) return null;

  return (
    <section className={styles.newsSection}>
      <h2 className={styles.newsSectionTitle}>LATEST NEWS</h2>
      <div className={styles.newsGrid}>
        {articles.map((article) => (
          <div
            key={article.id}
            className={styles.newsCard}
            onClick={() => router.push(`/public/news/${article.slug}`)}
          >
            {article.coverImageUrl && (
              <img
                src={article.coverImageUrl}
                alt={article.title}
                className={styles.newsCardImage}
              />
            )}
            <div className={styles.newsCardBody}>
              <div className={styles.newsCardCategory}>
                {categoryLabelMap[article.category] || article.category}
              </div>
              <div className={styles.newsCardTitle}>{article.title}</div>
              <div className={styles.newsCardDate}>
                {dayjs(article.publishedAt || article.createdAt).format(
                  'YYYY-MM-DD',
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
