'use client';

import { useEffect, useState, useCallback } from 'react';
import { Spin, Input, Pagination } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { getPublicArticles, getPublicCategories } from '@/lib/api/content';
import { getPublicSiteConfig } from '@/lib/api/site-manage';
import type { Article, ArticleCategory, SiteSettings } from '@/lib/types';
import dayjs from 'dayjs';

export default function NewsListPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [settings, setSettings] = useState<Partial<SiteSettings>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const layout = settings.newsLayout || 'magazine';
  const pageSize = settings.newsPerPage || 12;
  const showCover = settings.newsShowCover !== false;
  const showViewCount = settings.newsShowViewCount !== false;
  const showSearch = settings.newsShowSearch !== false;
  const pageTitle = settings.newsPageTitle || '最新消息';
  const pageSubtitle = settings.newsPageSubtitle || '探索始祖天堂的最新動態';
  const bannerUrl = settings.newsBannerUrl;

  const fetchData = useCallback(async (p: number, cat: string) => {
    setLoading(true);
    try {
      const [articleResult, catResult, configResult] = await Promise.all([
        getPublicArticles(p, pageSize, cat || undefined),
        getPublicCategories().catch(() => []),
        getPublicSiteConfig().catch(() => null),
      ]);
      setArticles(articleResult.items);
      setTotal(articleResult.total);
      setCategories(catResult);
      if (configResult?.settings) setSettings(configResult.settings);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchData(page, category);
  }, [page, category, fetchData]);

  const filteredArticles = search
    ? articles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : articles;

  const getExcerpt = (content: string, len = 100) => {
    const plain = content.replace(/<[^>]*>/g, '');
    return plain.length > len ? plain.substring(0, len) + '...' : plain;
  };

  const getCategoryName = (slug: string) => {
    const cat = categories.find((c) => c.slug === slug);
    return cat?.name || slug;
  };

  const getCategoryColor = (slug: string) => {
    const cat = categories.find((c) => c.slug === slug);
    return cat?.color || '#c4a24e';
  };

  const goToArticle = (slug: string) => router.push(`/public/news/${slug}`);

  // Separate pinned (hero) article for magazine layout
  const heroArticle = layout === 'magazine' ? filteredArticles.find((a) => a.isPinned) || filteredArticles[0] : null;
  const gridArticles = layout === 'magazine' && heroArticle
    ? filteredArticles.filter((a) => a.id !== heroArticle.id)
    : filteredArticles;

  // Group by month for timeline layout
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
        <h1 style={{ fontSize: 36, fontWeight: 300, letterSpacing: 4, color: '#fff', fontFamily: 'Georgia, serif', position: 'relative', zIndex: 1 }}>
          {pageTitle}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8, position: 'relative', zIndex: 1 }}>
          {pageSubtitle}
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Category Tabs + Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setCategory(''); setPage(1); }}
              style={{
                padding: '8px 20px', borderRadius: 20,
                background: !category ? 'rgba(196,162,78,0.15)' : '#1a1a1a',
                border: `1px solid ${!category ? '#c4a24e' : '#333'}`,
                color: !category ? '#c4a24e' : '#aaa',
                fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.slug); setPage(1); }}
                style={{
                  padding: '8px 20px', borderRadius: 20,
                  background: category === cat.slug ? 'rgba(196,162,78,0.15)' : '#1a1a1a',
                  border: `1px solid ${category === cat.slug ? '#c4a24e' : '#333'}`,
                  color: category === cat.slug ? '#c4a24e' : '#aaa',
                  fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {showSearch && (
            <Input
              prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
              placeholder="搜尋文章..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' }}
            />
          )}
        </div>

        {/* Loading / Empty */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : filteredArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>目前沒有文章</div>
        ) : (
          <>
            {/* ═══ Magazine Layout ═══ */}
            {layout === 'magazine' && (
              <>
                {/* Hero article */}
                {heroArticle && (
                  <div
                    onClick={() => goToArticle(heroArticle.slug)}
                    style={{
                      position: 'relative', borderRadius: 12, overflow: 'hidden',
                      height: 400, marginBottom: 24, cursor: 'pointer',
                      background: heroArticle.coverImageUrl && showCover
                        ? `linear-gradient(transparent 30%, rgba(0,0,0,0.85)), url(${heroArticle.coverImageUrl}) center/cover`
                        : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                    }}
                  >
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 40 }}>
                      <span style={{
                        display: 'inline-block', background: getCategoryColor(heroArticle.category || ''),
                        color: '#000', padding: '4px 12px', borderRadius: 3, fontSize: 11,
                        letterSpacing: 1, marginBottom: 12, fontWeight: 600,
                      }}>
                        {getCategoryName(heroArticle.category || '')}
                      </span>
                      <div style={{ fontSize: 28, fontWeight: 600, color: '#fff', marginBottom: 8, lineHeight: 1.3 }}>
                        {heroArticle.title}
                      </div>
                      <div style={{ color: '#999', fontSize: 13 }}>
                        {dayjs(heroArticle.publishedAt || heroArticle.createdAt).format('YYYY-MM-DD')}
                        {showViewCount && ` · ${heroArticle.viewCount} 次瀏覽`}
                        {heroArticle.isPinned && ' · 置頂'}
                      </div>
                    </div>
                  </div>
                )}
                {/* Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  {gridArticles.map((a) => (
                    <MagazineCard key={a.id} article={a} showCover={showCover} showViewCount={showViewCount}
                      getCategoryName={getCategoryName} getCategoryColor={getCategoryColor}
                      onClick={() => goToArticle(a.slug)} />
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
                    {/* Month label */}
                    <div style={{ position: 'relative', marginBottom: 24, padding: '8px 0' }}>
                      <span style={{
                        position: 'absolute', left: -52, background: '#c4a24e', color: '#000',
                        padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, letterSpacing: 1,
                      }}>
                        {month}
                      </span>
                    </div>
                    {items.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => goToArticle(a.slug)}
                        style={{
                          position: 'relative', marginBottom: 24, padding: 24,
                          background: '#141414', borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer', transition: 'all 0.2s',
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
                              <img src={a.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: getCategoryColor(a.category || ''), letterSpacing: 1, marginBottom: 6 }}>
                              {getCategoryName(a.category || '')}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 500, color: '#eee', marginBottom: 8, lineHeight: 1.4 }}>
                              {a.title}
                            </div>
                            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                              {getExcerpt(a.content, 150)}
                            </div>
                            {showViewCount && (
                              <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>{a.viewCount} 次瀏覽</div>
                            )}
                          </div>
                        </div>
                      </div>
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
                    <div
                      key={a.id}
                      onClick={() => goToArticle(a.slug)}
                      style={{
                        breakInside: 'avoid' as const, marginBottom: 20,
                        background: '#141414', borderRadius: 8, overflow: 'hidden',
                        cursor: 'pointer', transition: 'transform 0.2s',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {imgH > 0 && a.coverImageUrl && (
                        <img src={a.coverImageUrl} alt="" style={{ width: '100%', height: imgH, objectFit: 'cover' }} />
                      )}
                      {imgH > 0 && !a.coverImageUrl && (
                        <div style={{ width: '100%', height: imgH, background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }} />
                      )}
                      <div style={{ padding: 16 }}>
                        <div style={{ fontSize: 11, color: getCategoryColor(a.category || ''), letterSpacing: 1, marginBottom: 6 }}>
                          {getCategoryName(a.category || '')}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#eee', marginBottom: 8, lineHeight: 1.4 }}>
                          {a.title}
                        </div>
                        {i % 3 !== 1 && (
                          <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 8 }}>
                            {getExcerpt(a.content, 80)}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#555' }}>
                          {dayjs(a.publishedAt || a.createdAt).format('YYYY-MM-DD')}
                          {showViewCount && ` · ${a.viewCount} 次瀏覽`}
                        </div>
                      </div>
                    </div>
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
    </div>
  );
}

// ═══ Magazine Card Component ═══
function MagazineCard({
  article, showCover, showViewCount, getCategoryName, getCategoryColor, onClick,
}: {
  article: Article; showCover: boolean; showViewCount: boolean;
  getCategoryName: (s: string) => string; getCategoryColor: (s: string) => string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#141414', borderRadius: 8, overflow: 'hidden',
        cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
        border: '1px solid rgba(255,255,255,0.06)',
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
        <div style={{ fontSize: 11, color: getCategoryColor(article.category || ''), letterSpacing: 1, marginBottom: 8 }}>
          {getCategoryName(article.category || '')}
        </div>
        <div style={{
          fontSize: 15, fontWeight: 500, color: '#eee', marginBottom: 8, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
        }}>
          {article.title}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {dayjs(article.publishedAt || article.createdAt).format('YYYY-MM-DD')}
          {showViewCount && ` · ${article.viewCount} 次瀏覽`}
        </div>
      </div>
    </div>
  );
}
