'use client';

import { useEffect, useState } from 'react';
import { Spin, Button } from 'antd';
import { ArrowLeftOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import { getPublicArticleBySlug, getAdjacentArticles } from '@/lib/api/content';
import type { Article } from '@/lib/types';
import dayjs from 'dayjs';

interface AdjacentArticle {
  title: string;
  slug: string;
  coverImageUrl: string | null;
}

export default function ArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [prevArticle, setPrevArticle] = useState<AdjacentArticle | null>(null);
  const [nextArticle, setNextArticle] = useState<AdjacentArticle | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [data, adjacent] = await Promise.all([
          getPublicArticleBySlug(slug),
          getAdjacentArticles(slug).catch(() => ({ prev: null, next: null })),
        ]);
        setArticle(data);
        setPrevArticle(adjacent.prev);
        setNextArticle(adjacent.next);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 200, color: 'rgba(255,255,255,0.6)' }}>
        <h2 style={{ fontSize: 24, color: '#fff', marginBottom: 16 }}>找不到文章</h2>
        <p>您要尋找的文章不存在或已被移除。</p>
        <Button onClick={() => router.push('/public/news')} style={{ marginTop: 16 }}>返回消息列表</Button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 'var(--header-total-height, 89px)' }}>
      {/* Cover Banner — auto height, supports GIF */}
      {article.coverImageUrl ? (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <img
            src={article.coverImageUrl}
            alt={article.title}
            style={{
              width: '100%',
              maxHeight: '70vh',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 60%, rgba(10,10,10,1) 100%)',
            }}
          />
        </div>
      ) : (
        <div style={{ height: 120, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
      )}

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Back button */}
        <button
          onClick={() => router.push('/public/news')}
          style={{
            background: 'none', border: 'none', color: '#c4a24e', cursor: 'pointer',
            fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            padding: '16px 0', marginTop: article.coverImageUrl ? -40 : 16,
            position: 'relative', zIndex: 2,
          }}
        >
          <ArrowLeftOutlined /> 返回消息列表
        </button>

        {/* Category */}
        <div style={{ fontSize: 12, color: '#c4a24e', letterSpacing: 2, marginBottom: 12, marginTop: 16 }}>
          {(article.category || '').toUpperCase()}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 32, fontWeight: 400, color: '#fff', lineHeight: 1.4, marginBottom: 16 }}>
          {article.title}
        </h1>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 40, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          <span>{dayjs(article.publishedAt || article.createdAt).format('YYYY-MM-DD HH:mm')}</span>
          <span>{article.viewCount} 次瀏覽</span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 40 }} />

        {/* Article Content */}
        <div
          className="article-content"
          style={{ fontSize: 16, lineHeight: 2, color: 'rgba(255,255,255,0.8)' }}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
        <style jsx global>{`
          .article-content img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 8px 0;
          }
          .article-content img[data-text-align="center"] {
            display: block;
            margin-left: auto;
            margin-right: auto;
          }
          .article-content img[data-text-align="right"] {
            display: block;
            margin-left: auto;
            margin-right: 0;
          }
          .article-content p {
            margin: 0.5em 0;
          }
          .article-content a {
            color: var(--accent-gold, #c4a24e);
            text-decoration: underline;
          }
        `}</style>

        {/* ═══ Prev / Next Navigation ═══ */}
        {(prevArticle || nextArticle) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginTop: 60,
              paddingTop: 32,
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Previous */}
            {prevArticle ? (
              <div
                onClick={() => router.push(`/public/news/${prevArticle.slug}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 20px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(196,162,78,0.3)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <LeftOutlined style={{ color: '#c4a24e', fontSize: 16, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>上一篇</div>
                  <div style={{
                    fontSize: 14, color: '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {prevArticle.title}
                  </div>
                </div>
              </div>
            ) : <div />}

            {/* Next */}
            {nextArticle ? (
              <div
                onClick={() => router.push(`/public/news/${nextArticle.slug}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 20px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  textAlign: 'right', justifyContent: 'flex-end',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(196,162,78,0.3)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>下一篇</div>
                  <div style={{
                    fontSize: 14, color: '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {nextArticle.title}
                  </div>
                </div>
                <RightOutlined style={{ color: '#c4a24e', fontSize: 16, flexShrink: 0 }} />
              </div>
            ) : <div />}
          </div>
        )}
      </div>
    </div>
  );
}
