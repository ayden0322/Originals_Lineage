'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAccessToken, clearTokens, AUTH_CHANGED_EVENT } from '@/lib/api/client';
import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import styles from '@/app/public/styles/public.module.css';

export default function PublicHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { config } = useSiteConfig();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 重新讀取登入狀態（getAccessToken 會自動清掉過期 token，所以這裡也是真實狀態）
    const refresh = () => {
      const token = getAccessToken('player');
      setIsLoggedIn(!!token);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setDisplayName(payload.gameAccountName || payload.email || '用戶');
        } catch {
          setDisplayName('用戶');
        }
      } else {
        setDisplayName('');
      }
    };

    refresh();

    // 1. token 變動事件（同分頁，例如 API 401 自動 clearTokens、登入/登出）
    const onAuthChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ role: string }>).detail;
      if (!detail || detail.role === 'player') refresh();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);

    // 2. 跨分頁 storage 事件
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'playerAccessToken') refresh();
    };
    window.addEventListener('storage', onStorage);

    // 3. 視窗重新取得焦點時重新檢查（覆蓋「使用者離開分頁很久回來」的情境）
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    clearTokens('player');
    setIsLoggedIn(false);
    setDisplayName('');
    setUserMenuOpen(false);
    router.push('/public');
  };

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const downloadUrl = config?.settings.gameDownloadUrl;
  const logoSize = config?.settings.logoSize || 'medium';
  const logoHeightMap: Record<string, number> = { small: 28, medium: 36, large: 48 };
  const logoHeight = logoHeightMap[logoSize] || 36;

  // 上層列高度 = logo 高度 + 上下 padding
  const topRowPaddingV = logoSize === 'large' ? 12 : logoSize === 'small' ? 6 : 8;
  const topRowHeight = logoHeight + topRowPaddingV * 2;
  // 下層導覽列固定 44px
  const navRowHeight = 44;
  const totalHeaderHeight = topRowHeight + 1 + navRowHeight; // +1 = divider

  // 同步 CSS 變數，讓所有頁面 paddingTop 自動調整
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--header-top-height', `${topRowHeight}px`);
    root.style.setProperty('--header-total-height', `${totalHeaderHeight}px`);
    return () => {
      root.style.removeProperty('--header-top-height');
      root.style.removeProperty('--header-total-height');
    };
  }, [topRowHeight, totalHeaderHeight]);

  const topLinks = [
    { label: '更新歷程', path: '/public/changelog', external: false },
    { label: '聯繫客服', path: '/public/support', external: false },
    { label: '遊戲下載', path: downloadUrl || '#', external: !!downloadUrl },
  ];

  const reserveEnabled = config?.settings.reserveEnabled;

  const mainNav = [
    { label: '首頁', path: '/public' },
    { label: '最新消息', path: '/public/news' },
    ...(reserveEnabled ? [{ label: '事前預約', path: '/public/reserve' }] : []),
    { label: '贊助專區', path: '/public/sponsor' },
    { label: '線上商城', path: '/public/shop' },
    { label: '活動內容', path: '/public/events' },
    { label: '掉落查詢', path: '/public/drops' },
  ];

  // On non-homepage, always show solid header background
  const isHomePage = pathname === '/public' || pathname === '/public/';
  const showSolidBg = !isHomePage || scrolled;

  return (
    <header
      className={`${styles.headerWrapper} ${showSolidBg ? styles.headerWrapperScrolled : ''}`}
    >
      {/* ─── Top bar: logo + utility links + user ─── */}
      <div className={styles.headerTop} style={{ height: topRowHeight, padding: `${topRowPaddingV}px 32px` }}>
        <div className={styles.headerTopInner}>
          {/* Logo */}
          <div
            className={styles.headerLogo}
            onClick={() => router.push('/public')}
          >
            {config?.settings.logoUrl ? (
              <img
                src={config.settings.logoUrl}
                alt={config.settings.siteName || ''}
                style={{ height: logoHeight, cursor: 'pointer' }}
              />
            ) : (
              <span className={styles.logoText}>
                {config?.settings.siteName || '始祖天堂'}
              </span>
            )}
          </div>
          <div className={styles.headerTopRight}>
            {topLinks.map((item) => (
              <button
                key={item.label}
                className={styles.headerTopLink}
                onClick={() => {
                  if (item.external) {
                    window.open(item.path, '_blank', 'noopener,noreferrer');
                  } else {
                    router.push(item.path);
                  }
                }}
              >
                {item.label}
              </button>
            ))}
            <span className={styles.headerTopDivider} />
            {isLoggedIn ? (
              <div className={styles.userMenuWrapper} ref={userMenuRef}>
                <button
                  className={styles.userMenuTrigger}
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                >
                  <span className={styles.headerTopUser}>{displayName}</span>
                  <span className={styles.userMenuArrow}>{userMenuOpen ? '▲' : '▼'}</span>
                </button>
                {userMenuOpen && (
                  <div className={styles.userMenuDropdown}>
                    <button
                      className={styles.userMenuItem}
                      onClick={() => { setUserMenuOpen(false); router.push('/public/profile'); }}
                    >
                      個人資料
                    </button>
                    <button
                      className={styles.userMenuItem}
                      onClick={() => { setUserMenuOpen(false); router.push('/public/profile#orders'); }}
                    >
                      訂單查詢
                    </button>
                    <div className={styles.userMenuDivider} />
                    <button className={styles.userMenuItem} onClick={handleLogout}>
                      登出
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className={styles.headerTopLink}
                onClick={() => router.push('/auth/login?tab=player')}
              >
                登入 / 註冊
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Divider line ─── */}
      <div className={styles.headerDivider} />

      {/* ─── Main nav bar: navigation ─── */}
      <div className={styles.headerMain}>
        <div className={styles.headerMainInner}>
          <nav>
            <ul className={styles.nav}>
              {mainNav.map((item) => (
                <li key={item.path}>
                  <button
                    className={`${styles.navLink} ${
                      pathname === item.path ? styles.navLinkActive : ''
                    }`}
                    onClick={() => router.push(item.path)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
