'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPublicCategories, getPublicArticles } from '@/lib/api/content';
import type { ArticleCategory, Article } from '@/lib/types';

/**
 * Right-bottom floating card showing categorized article lists.
 * - Tabs for each category (only categories with articles)
 * - Paginated article title list (6 per page)
 * - Click title to navigate to article page
 */

const PER_PAGE = 6;
const LATEST_TAB = '__latest__';

export default function AnnouncementFloat() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [activeTab, setActiveTab] = useState<string>(LATEST_TAB);
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntrance, setHasEntrance] = useState(true); // only true on first render
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setHasEntrance(false); // disable entrance animation after first interaction
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Fetch categories on mount
  useEffect(() => {
    getPublicCategories()
      .then((cats) => {
        setCategories(cats);
        setActiveTab(LATEST_TAB); // always default to "最新"
        setTimeout(() => setVisible(true), 1200);
      })
      .catch(() => {
        // Even without categories, show with "最新" tab
        setTimeout(() => setVisible(true), 1200);
      });
  }, []);

  // Fetch articles when tab or page changes
  const fetchArticles = useCallback(async () => {
    if (!activeTab) return;
    setLoadingArticles(true);
    try {
      // "最新" tab: no category filter, gets all articles sorted by newest
      const category = activeTab === LATEST_TAB ? undefined : activeTab;
      const result = await getPublicArticles(page, PER_PAGE, category);
      setArticles(result.items);
      setTotal(result.total);
    } catch {
      setArticles([]);
      setTotal(0);
    } finally {
      setLoadingArticles(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Filter out categories with no articles (check after first load)
  // We keep all categories from API since backend returns active ones

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleReopen = () => {
    setDismissed(false);
    setPosition({ x: 0, y: 0 });
    setHasEntrance(true);
    // Turn off entrance animation after it plays
    setTimeout(() => setHasEntrance(false), 500);
  };

  const handleTabChange = (slug: string) => {
    setActiveTab(slug);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  if (!visible) return null;

  // Minimized state — show small floating button
  if (dismissed) {
    return (
      <button
        onClick={handleReopen}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1050,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(17, 17, 17, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(196, 162, 78, 0.3)',
          color: '#c4a24e',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          transition: 'all 0.25s ease',
          animation: 'floatIn 0.3s ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.borderColor = 'rgba(196, 162, 78, 0.6)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(196, 162, 78, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.borderColor = 'rgba(196, 162, 78, 0.3)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
        }}
        title="開啟系統公告"
      >
        ☰
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 24 - position.x,
        bottom: 24 - position.y,
        zIndex: 1050,
        width: 380,
        opacity: isDragging ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
        animation: hasEntrance ? 'floatIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          background: 'rgba(17, 17, 17, 0.95)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${isDragging ? 'rgba(196,162,78,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: isDragging
            ? '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(196,162,78,0.15)'
            : '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(196,162,78,0.1)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: 1, pointerEvents: 'none' }}>
            系統公告
          </span>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '2px 4px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
          >
            ✕
          </button>
        </div>

        {/* Category Tabs — "最新" is always first */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            overflowX: 'auto',
          }}
        >
          {[
            { id: LATEST_TAB, slug: LATEST_TAB, name: '最新', color: '#c4a24e' },
            ...categories.map((c) => ({ ...c, color: c.color || '#c4a24e' })),
          ].map((cat) => {
            const isActive = cat.slug === activeTab;
            const tabColor = cat.color || '#c4a24e';
            return (
              <button
                key={cat.id}
                onClick={() => handleTabChange(cat.slug)}
                style={{
                  flex: 'none',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${tabColor}` : '2px solid transparent',
                  color: isActive ? tabColor : 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  letterSpacing: 0.5,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Article List */}
        <div style={{ padding: '8px 0', minHeight: 200 }}>
          {loadingArticles ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              載入中...
            </div>
          ) : articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              此分類暫無文章
            </div>
          ) : (
            articles.map((article, idx) => (
              <button
                key={article.id}
                onClick={() => router.push(`/public/news/${article.slug}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: idx < articles.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                {/* Date */}
                <span
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.3)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    minWidth: 42,
                  }}
                >
                  {new Date(article.createdAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                </span>

                {/* Title */}
                <span
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.8)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#c4a24e'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                >
                  {article.title}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 16,
              padding: '8px 16px 12px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                background: 'none',
                border: 'none',
                color: page <= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
                cursor: page <= 1 ? 'default' : 'pointer',
                fontSize: 13,
                padding: '4px 8px',
              }}
            >
              ‹ 上一頁
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                background: 'none',
                border: 'none',
                color: page >= totalPages ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
                cursor: page >= totalPages ? 'default' : 'pointer',
                fontSize: 13,
                padding: '4px 8px',
              }}
            >
              下一頁 ›
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
