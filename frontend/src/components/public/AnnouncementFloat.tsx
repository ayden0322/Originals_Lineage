'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getPublicCategories, getPublicArticles } from '@/lib/api/content';
import type { ArticleCategory, Article } from '@/lib/types';

/**
 * 這些頁面的浮動公告預設要縮成小按鈕，避免擋住主要內容。
 * 使用者點開按鈕後才會展開。
 */
const PAGES_DEFAULT_MINIMIZED = ['/public/shop'];
const MOBILE_BREAKPOINT = 768;
// 小於此寬度預設收合為 FAB，避免右下浮窗擋住 Hero 主視覺
const DEFAULT_MINIMIZE_BREAKPOINT = 1024;
const DISMISS_STORAGE_KEY = 'announcementFloat.dismissed';

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
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // 決定「初始是否要最小化」：
  // 1. 當前頁面在 PAGES_DEFAULT_MINIMIZED 列表（例如商城）→ 是
  // 2. 畫面寬度 < 768px（手機）→ 是，避免擋住主要內容
  // 3. 使用者先前已手動關閉（sessionStorage 記憶）→ 是
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shouldMinimize =
      PAGES_DEFAULT_MINIMIZED.some((p) => pathname?.startsWith(p)) ||
      window.innerWidth < DEFAULT_MINIMIZE_BREAKPOINT ||
      sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    if (shouldMinimize) setDismissed(true);
  }, [pathname]);
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

  // 卡片 ref：用來量高度，把高度寫到 CSS var --announcement-height，
  // 讓其他右下 FAB（例如 LineInviteFloat）可以 calc 自動往上讓位。
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Tabs 滾動容器 + 各 tab 按鈕 ref，用來在切換時把選中的 tab 滑進可視範圍
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  // 切換分類時，把選中的 tab 滑進可視範圍中央，避免被左右遮罩擋住
  useEffect(() => {
    const btn = tabRefs.current[activeTab];
    if (btn) btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab, categories]);

  // 把卡片實際高度寫到 :root CSS var，供 LineInviteFloat 等右下 FAB 自動避讓。
  // dismissed 或還沒 visible 時清成 0。
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const clear = () => root.style.setProperty('--announcement-height', '0px');

    if (dismissed || !visible) {
      clear();
      return clear;
    }
    const el = cardRef.current;
    if (!el) {
      clear();
      return;
    }
    const update = () => {
      const h = el.offsetHeight;
      // 卡片高度 + 8px 間距，讓 FAB 停在卡片上緣再往上一點
      root.style.setProperty('--announcement-height', `${h + 8}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clear();
    };
    // ResizeObserver 會抓到 articles 或分頁變動造成的高度變化，不必把它們放 deps
  }, [dismissed, visible]);

  // Filter out categories with no articles (check after first load)
  // We keep all categories from API since backend returns active ones

  const handleDismiss = () => {
    setDismissed(true);
    // 記住使用者的關閉意圖，當次 session 都保持縮小
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    }
  };

  const handleReopen = () => {
    setDismissed(false);
    setPosition({ x: 0, y: 0 });
    setHasEntrance(true);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(DISMISS_STORAGE_KEY);
    }
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
    const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
    const fabSize = isMobile ? 44 : 48;
    return (
      <button
        onClick={handleReopen}
        style={{
          position: 'fixed',
          right: isMobile ? 16 : 24,
          bottom: isMobile ? 16 : 24,
          zIndex: 1050,
          width: fabSize,
          height: fabSize,
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
      ref={cardRef}
      style={{
        position: 'fixed',
        right: `calc(max(16px, env(safe-area-inset-right, 0px)) - ${position.x}px)`,
        bottom: `calc(max(16px, env(safe-area-inset-bottom, 0px)) - ${position.y}px)`,
        zIndex: 1050,
        width: 'min(380px, calc(100vw - 32px))',
        maxWidth: '380px',
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
            // 阻止 mousedown 冒泡到 header 的 drag handler，避免 drag preventDefault 吃掉 click。
            // 否則瀏覽器會把「按住 ✕」當成拖曳起點，handleDismiss 永遠不會被呼叫。
            onMouseDown={(e) => e.stopPropagation()}
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
        {/* 外層 wrapper：左右漸層遮罩，暗示可橫向滑動 */}
        <div
          style={{
            position: 'relative',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            ref={tabsScrollRef}
            className="announcement-tabs-scroll"
            style={{
              display: 'flex',
              gap: 0,
              overflowX: 'auto',
              scrollBehavior: 'smooth',
              maskImage: 'linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)',
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
                  ref={(el) => { tabRefs.current[cat.slug] = el; }}
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
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
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
        /* 隱藏分類 tabs 的水平滾動條（保留可滾動行為） */
        .announcement-tabs-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .announcement-tabs-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
