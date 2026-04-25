'use client';

import { useEffect, useState, useCallback } from 'react';
import { Spin, Input, Pagination } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import { getPublicArticles } from '@/lib/api/content';
import type { Article } from '@/lib/types';
import PublicFooter from '@/components/public/PublicFooter';
import dayjs from 'dayjs';

function getExcerptText(content: string, len = 100) {
  const plain = content.replace(/<[^>]*>/g, '');
  return plain.length > len ? plain.substring(0, len) + '...' : plain;
}

export default function ChangelogPage() {
  const { config, loading: configLoading } = useSiteConfig();

  const settings = config?.settings;
  const bannerUrl = settings?.changelogBannerUrl || '';
  const categorySlug = settings?.changelogCategorySlug || '';
  const pageTitle = settings?.changelogPageTitle || '更新歷程';
  const pageSubtitle = settings?.changelogPageSubtitle || '';
  const layout = settings?.changelogLayout || 'timeline';
  const pageSize = settings?.changelogPerPage || 12;
  const showCover = settings?.changelogShowCover !== false;
  const showViewCount = settings?.changelogShowViewCount !== false;
  const showSearch = settings?.changelogShowSearch === true;

  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchArticles = useCallback(
    async (p: number) => {
      if (!categorySlug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await getPublicArticles(p, pageSize, categorySlug);
        setArticles(result.items);
        setTotal(result.total);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    [categorySlug, pageSize],
  );

  useEffect(() => {
    if (categorySlug) {
      fetchArticles(page);
    } else if (!configLoading) {
      setLoading(false);
    }
  }, [page, categorySlug, configLoading, fetchArticles]);

  const filteredArticles = search
    ? articles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : articles;

  const getExcerpt = getExcerptText;

  const heroArticle = layout === 'magazine' ? filteredArticles.find((a) => a.isPinned) || filteredArticles[0] : null;
  const gridArticles = layout === 'magazine' && heroArticle
    ? filteredArticles.filter((a) => a.id !== heroArticle.id)
    : filteredArticles;

  const groupedByMonth = filteredArticles.reduce<Record<string, Article[]>>((acc, a) => {
    const month = dayjs(a.publishedAt || a.createdAt).format('YYYY / MM');
    if (!acc[month]) acc[month] = [];
    acc[month].push(a);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', paddingTop: 'var(--header-total-height, 89px)' }}>
      {/* Banner */}
      <div
        style={{
          height: 220,
          background: bannerUrl
            ? `linear-gradient(rgba(0,0,0,0.5), rgba(10,10,10,0.9)), url(${bannerUrl}) center/cover`
            : 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1a1a2e 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(196,162,78,0.06), transparent 70%)' }} />
        <h1 style={{ fontSize: 36, fontWeight: 300, letterSpacing: 4, color: '#fff', fontFamily: 'var(--font-heading)', position: 'relative', zIndex: 1 }}>
          {pageTitle}
        </h1>
        {pageSubtitle && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8, position: 'relative', zIndex: 1 }}>
            {pageSubtitle}
          </p>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Search bar (optional) */}
        {showSearch && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
            <Input
              prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
              placeholder="搜尋文章..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' }}
            />
          </div>
        )}

        {/* Loading / Empty */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : filteredArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>
            {!categorySlug ? '尚未設定更新歷程分類，請至後台「更新頁面管理」綁定分類' : '暫無更新紀錄'}
          </div>
        ) : (
          <>
            {/* ═══ Magazine Layout ═══ */}
            {layout === 'magazine' && (
              <>
                {heroArticle && (
                  <Link
                    href={`/public/news/${heroArticle.slug}`}
                    aria-label={heroArticle.title}
                    style={{
                      display: 'block', position: 'relative', borderRadius: 12, overflow: 'hidden',
                      height: 400, marginBottom: 24, cursor: 'pointer',
                      textDecoration: 'none',
                      background: heroArticle.coverImageUrl && showCover
                        ? `linear-gradient(transparent 30%, rgba(0,0,0,0.85)), url(${heroArticle.coverImageUrl}) center/cover`
                        : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                    }}
                  >
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 40 }}>
                      <div style={{ fontSize: 28, fontWeight: 600, color: '#fff', marginBottom: 8, lineHeight: 1.3 }}>
                        {heroArticle.title}
                      </div>
                      {(heroArticle.summary || heroArticle.content) && (
                        <div style={{
                          color: '#ddd', fontSize: 14, lineHeight: 1.6, marginBottom: 12,
                          whiteSpace: heroArticle.summary ? 'pre-line' as const : 'normal' as const,
                          display: heroArticle.summary ? 'block' : '-webkit-box',
                          WebkitLineClamp: heroArticle.summary ? undefined : 2,
                          WebkitBoxOrient: heroArticle.summary ? undefined : 'vertical' as const,
                          overflow: 'hidden',
                        }}>
                          {heroArticle.summary || getExcerpt(heroArticle.content, 120)}
                        </div>
                      )}
                      <div style={{ color: '#999', fontSize: 13 }}>
                        {dayjs(heroArticle.publishedAt || heroArticle.createdAt).format('YYYY-MM-DD')}
                        {showViewCount && ` · ${heroArticle.viewCount} 次瀏覽`}
                        {heroArticle.isPinned && ' · 置頂'}
                      </div>
                    </div>
                  </Link>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  {gridArticles.map((a) => (
                    <MagazineCard key={a.id} article={a} showCover={showCover} showViewCount={showViewCount} />
                  ))}
                </div>
              </>
            )}

            {/* ═══ Timeline Layout ═══ */}
            {layout === 'timeline' && (
              <div style={{ position: 'relative', paddingLeft: 60, marginLeft: 80 }}>
                <div style={{ position: 'absolute', left: 28, top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, #c4a24e, #333, #c4a24e)' }} />
                {Object.entries(groupedByMonth).map(([month, items]) => (
                  <div key={month}>
                    <div style={{ position: 'relative', marginBottom: 24, padding: '8px 0' }}>
                      <span style={{
                        position: 'absolute', left: -52, background: '#c4a24e', color: '#000',
                        padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, letterSpacing: 1,
                      }}>
                        {month}
                      </span>
                    </div>
                    {items.map((a) => (
                      <Link
                        key={a.id}
                        href={`/public/news/${a.slug}`}
                        aria-label={a.title}
                        style={{
                          display: 'block',
                          position: 'relative', marginBottom: 24, padding: 24,
                          background: '#141414', borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer', transition: 'all 0.2s',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(196,162,78,0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                      >
                        <div style={{ position: 'absolute', left: -40, top: 28, width: 12, height: 12, borderRadius: '50%', background: '#c4a24e', border: '2px solid #0a0a0a' }} />
                        <div style={{ position: 'absolute', left: -100, top: 24, color: '#666', fontSize: 13, textAlign: 'right', width: 50 }}>
                          {dayjs(a.publishedAt || a.createdAt).format('MM-DD')}
                        </div>
                        <div style={{ display: 'flex', gap: 20 }}>
                          {showCover && a.coverImageUrl && (
                            <div style={{ width: 160, height: 100, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                              <img src={a.coverImageUrl} alt={a.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 18, fontWeight: 500, color: '#eee', marginBottom: 8, lineHeight: 1.4 }}>
                              {a.title}
                            </div>
                            <div style={a.summary
                              ? { fontSize: 13, color: '#888', lineHeight: 1.6, whiteSpace: 'pre-line' as const }
                              : { fontSize: 13, color: '#888', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
                            }>
                              {a.summary || getExcerpt(a.content, 150)}
                            </div>
                            {showViewCount && (
                              <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>{a.viewCount} 次瀏覽</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* ═══ Masonry Layout ═══ */}
            {layout === 'masonry' && (
              <div style={{ columns: 3, columnGap: 20 }}>
                {filteredArticles.map((a, i) => {
                  const heights = [260, 180, 220, 160, 280, 200, 190, 240, 170];
                  const imgH = showCover && a.coverImageUrl ? heights[i % heights.length] : 0;
                  return (
                    <Link
                      key={a.id}
                      href={`/public/news/${a.slug}`}
                      aria-label={a.title}
                      style={{
                        display: 'block',
                        breakInside: 'avoid' as const, marginBottom: 20,
                        background: '#141414', borderRadius: 8, overflow: 'hidden',
                        cursor: 'pointer', transition: 'transform 0.2s',
                        border: '1px solid rgba(255,255,255,0.06)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {imgH > 0 && a.coverImageUrl && (
                        <img src={a.coverImageUrl} alt={a.title} style={{ width: '100%', height: imgH, objectFit: 'cover' }} />
                      )}
                      {imgH > 0 && !a.coverImageUrl && (
                        <div style={{ width: '100%', height: imgH, background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }} />
                      )}
                      <div style={{ padding: 16 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#eee', marginBottom: 8, lineHeight: 1.4 }}>
                          {a.title}
                        </div>
                        {(a.summary || a.content) && (
                          <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 8, whiteSpace: a.summary ? 'pre-line' as const : 'normal' as const }}>
                            {a.summary || getExcerpt(a.content, 80)}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#555' }}>
                          {dayjs(a.publishedAt || a.createdAt).format('YYYY-MM-DD')}
                          {showViewCount && ` · ${a.viewCount} 次瀏覽`}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Pagination
              current={page} total={total} pageSize={pageSize}
              onChange={(p) => setPage(p)} showSizeChanger={false}
            />
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}

// ═══ Magazine Card Component ═══
function MagazineCard({
  article, showCover, showViewCount,
}: {
  article: Article; showCover: boolean; showViewCount: boolean;
}) {
  return (
    <Link
      href={`/public/news/${article.slug}`}
      aria-label={article.title}
      style={{
        display: 'block',
        background: '#141414', borderRadius: 8, overflow: 'hidden',
        cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
        border: '1px solid rgba(255,255,255,0.06)',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {showCover && (
        <div style={{
          width: '100%', height: 180,
          background: article.coverImageUrl
            ? `url(${article.coverImageUrl}) center/cover`
            : 'linear-gradient(135deg, #1a1a2e, #0f3460)',
        }} />
      )}
      <div style={{ padding: 16 }}>
        <div style={{
          fontSize: 15, fontWeight: 500, color: '#eee', marginBottom: 8, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
        }}>
          {article.title}
        </div>
        {(article.summary || article.content) && (
          <div style={{
            fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 8,
            whiteSpace: article.summary ? 'pre-line' as const : 'normal' as const,
            display: article.summary ? 'block' : '-webkit-box',
            WebkitLineClamp: article.summary ? undefined : 3,
            WebkitBoxOrient: article.summary ? undefined : 'vertical' as const,
            overflow: 'hidden',
          }}>
            {article.summary || getExcerptText(article.content, 80)}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#666' }}>
          {dayjs(article.publishedAt || article.createdAt).format('YYYY-MM-DD')}
          {showViewCount && ` · ${article.viewCount} 次瀏覽`}
        </div>
      </div>
    </Link>
  );
}
