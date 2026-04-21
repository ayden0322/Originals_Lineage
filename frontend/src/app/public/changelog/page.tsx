'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';
import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import { getPublicArticles } from '@/lib/api/content';
import type { Article } from '@/lib/types';
import PublicFooter from '@/components/public/PublicFooter';

const COLORS = {
  bg: '#0a0a0a',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.4)',
  accent: '#c4a24e',
  cardBg: 'rgba(255,255,255,0.03)',
};

const PAGE_SIZE = 10;

export default function ChangelogPage() {
  const router = useRouter();
  const { config, loading: configLoading } = useSiteConfig();

  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const bannerUrl = config?.settings?.changelogBannerUrl || '';
  const categorySlug = config?.settings?.changelogCategorySlug || '';
  const pageTitle = config?.settings?.changelogPageTitle || '更新歷程';

  const fetchArticles = useCallback(
    async (p: number, append = false) => {
      if (!categorySlug) return;
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const result = await getPublicArticles(p, PAGE_SIZE, categorySlug);
        setArticles((prev) => (append ? [...prev, ...result.items] : result.items));
        setTotal(result.total);
        setPage(p);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categorySlug],
  );

  useEffect(() => {
    // categorySlug 準備好就立刻拉（可能來自 localStorage 快取，不用等 API）
    if (categorySlug) {
      fetchArticles(1);
    } else if (!configLoading) {
      // config 已載入但仍無 categorySlug，結束 loading
      setLoading(false);
    }
  }, [configLoading, categorySlug, fetchArticles]);

  const hasMore = articles.length < total;

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchArticles(page + 1, true);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  };

  // 注意：不再 block 整頁的 configLoading，讓 header / banner 先渲染

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', color: COLORS.textPrimary, paddingTop: 'var(--header-total-height, 89px)' }}>
      {/* Banner */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'clamp(140px, 28vw, 200px)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {bannerUrl && (
          <img
            src={bannerUrl}
            alt={pageTitle}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.55)',
          }}
        />
        <h1
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 2,
            color: COLORS.textPrimary,
            margin: 0,
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}
        >
          {pageTitle}
        </h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(24px, 6vw, 48px) clamp(16px, 4vw, 24px) 64px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spin size="large" />
          </div>
        ) : articles.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: COLORS.textMuted,
              fontSize: 16,
              padding: '80px 0',
            }}
          >
            暫無更新記錄
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 36 }}>
            {/* Vertical timeline line */}
            <div
              style={{
                position: 'absolute',
                left: 4,
                top: 0,
                bottom: 0,
                width: 2,
                background: COLORS.accent,
              }}
            />

            {articles.map((article) => (
              <div key={article.id} style={{ position: 'relative', marginBottom: 32 }}>
                {/* Timeline node */}
                <div
                  style={{
                    position: 'absolute',
                    left: -36 + 4 - 4,
                    top: 6,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: COLORS.accent,
                    boxShadow: `0 0 8px ${COLORS.accent}`,
                  }}
                />

                {/* Content card */}
                <div
                  style={{
                    background: COLORS.cardBg,
                    borderRadius: 8,
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 6 }}>
                    {formatDate(article.publishedAt || article.createdAt)}
                  </div>

                  <div
                    onClick={() => router.push(`/public/news/${article.slug}`)}
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = COLORS.accent;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = COLORS.textPrimary;
                    }}
                  >
                    {article.title}
                  </div>

                  {article.summary && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 14,
                        color: COLORS.textMuted,
                        whiteSpace: 'pre-line',
                        lineHeight: 1.6,
                      }}
                    >
                      {article.summary}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                background: 'transparent',
                border: `1px solid ${COLORS.accent}`,
                color: COLORS.accent,
                padding: '10px 36px',
                borderRadius: 6,
                fontSize: 15,
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                opacity: loadingMore ? 0.6 : 1,
                transition: 'all 0.2s',
                letterSpacing: 1,
              }}
              onMouseEnter={(e) => {
                if (!loadingMore) {
                  (e.currentTarget as HTMLElement).style.background = COLORS.accent;
                  (e.currentTarget as HTMLElement).style.color = '#000';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = COLORS.accent;
              }}
            >
              {loadingMore ? '載入中...' : '載入更多'}
            </button>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}
