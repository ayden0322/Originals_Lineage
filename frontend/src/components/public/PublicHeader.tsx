'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    setMobileMenuOpen(false);
    router.push('/public');
  };

  // 切換路由時自動關閉行動版選單
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // 行動版選單開啟時鎖住背景捲動
  useEffect(() => {
    if (mobileMenuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileMenuOpen]);

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
    { label: '線上商城', path: '/public/shop' },
    { label: '掉落查詢', path: '/public/drops' },
  ];

  // On non-homepage, always show solid header background
  const isHomePage = pathname === '/public' || pathname === '/public/';
  const showSolidBg = !isHomePage || scrolled;

  return (
    <>
    <header
      className={`${styles.headerWrapper} ${showSolidBg ? styles.headerWrapperScrolled : ''}`}
    >
      {/* ─── Top bar: logo + utility links + user ─── */}
      <div className={styles.headerTop} style={{ height: topRowHeight, padding: `${topRowPaddingV}px 32px` }}>
        <div className={styles.headerTopInner}>
          {/* Logo */}
          <Link
            href="/public"
            className={styles.headerLogo}
            aria-label={`${config?.settings.siteName || '始祖天堂'} 首頁`}
          >
            {config?.settings.logoUrl ? (
              <img
                src={config.settings.logoUrl}
                alt={config.settings.siteName || '始祖天堂'}
                style={{ height: logoHeight, cursor: 'pointer' }}
              />
            ) : (
              <span className={styles.logoText}>
                {config?.settings.siteName || '始祖天堂'}
              </span>
            )}
          </Link>
          {/* Hamburger — 僅行動版顯示 */}
          <button
            type="button"
            className={styles.hamburger}
            aria-label={mobileMenuOpen ? '關閉選單' : '開啟選單'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <span className={`${styles.hamburgerBar} ${mobileMenuOpen ? styles.hamburgerBarOpen1 : ''}`} />
            <span className={`${styles.hamburgerBar} ${mobileMenuOpen ? styles.hamburgerBarOpen2 : ''}`} />
            <span className={`${styles.hamburgerBar} ${mobileMenuOpen ? styles.hamburgerBarOpen3 : ''}`} />
          </button>

          <div className={styles.headerTopRight}>
            {topLinks.map((item) =>
              item.external ? (
                <a
                  key={item.label}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.headerTopLink}
                >
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} href={item.path} className={styles.headerTopLink}>
                  {item.label}
                </Link>
              ),
            )}
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
                  <div className={styles.userMenuDropdown} role="menu">
                    <Link
                      href="/public/profile"
                      className={styles.userMenuItem}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      個人資料
                    </Link>
                    <Link
                      href="/public/profile#orders"
                      className={styles.userMenuItem}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      訂單查詢
                    </Link>
                    <div className={styles.userMenuDivider} />
                    <button
                      type="button"
                      className={styles.userMenuItem}
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      登出
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth/login?tab=player" className={styles.headerTopLink}>
                登入 / 註冊
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ─── Divider line ─── */}
      <div className={styles.headerDivider} />

      {/* ─── Main nav bar: navigation ─── */}
      <div className={styles.headerMain}>
        <div className={styles.headerMainInner}>
          <nav aria-label="主要導覽">
            <ul className={styles.nav}>
              {mainNav.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

    </header>

    {/* ─── Mobile Drawer（透過 portal 掛到 body，避開 header 的 backdrop-filter containing block） ─── */}
    {mounted &&
      createPortal(
        <>
          {mobileMenuOpen && (
            <div
              className={styles.mobileDrawerBackdrop}
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
          <aside
            className={`${styles.mobileDrawer} ${mobileMenuOpen ? styles.mobileDrawerOpen : ''}`}
            aria-hidden={!mobileMenuOpen}
            aria-label="行動版主要選單"
          >
            <nav className={styles.mobileNav} aria-label="主要導覽">
              {mainNav.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`${styles.mobileNavItem} ${
                      isActive ? styles.mobileNavItemActive : ''
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className={styles.mobileNavDivider} />
              {topLinks.map((item) =>
                item.external ? (
                  <a
                    key={item.label}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mobileNavItemSub}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    href={item.path}
                    className={styles.mobileNavItemSub}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ),
              )}
              <div className={styles.mobileNavDivider} />
              {isLoggedIn ? (
                <>
                  <div className={styles.mobileNavUser}>{displayName}</div>
                  <Link
                    href="/public/profile"
                    className={styles.mobileNavItemSub}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    個人資料
                  </Link>
                  <Link
                    href="/public/profile#orders"
                    className={styles.mobileNavItemSub}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    訂單查詢
                  </Link>
                  <button
                    type="button"
                    className={styles.mobileNavItemSub}
                    onClick={handleLogout}
                  >
                    登出
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/login?tab=player"
                  className={styles.mobileNavItemSub}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  登入 / 註冊
                </Link>
              )}
            </nav>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
