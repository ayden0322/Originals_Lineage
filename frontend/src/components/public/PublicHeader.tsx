'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAccessToken, clearTokens } from '@/lib/api/client';
import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import styles from '@/app/public/styles/public.module.css';

export default function PublicHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { config } = useSiteConfig();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const token = getAccessToken('player');
    setIsLoggedIn(!!token);
    // Try to get display name from localStorage
    if (token) {
      try {
        const user = localStorage.getItem('player_user');
        if (user) {
          const parsed = JSON.parse(user);
          setDisplayName(parsed.displayName || parsed.email || '用戶');
        }
      } catch {
        setDisplayName('用戶');
      }
    }
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
    router.push('/public');
  };

  const downloadUrl = config?.settings.gameDownloadUrl;

  const topLinks = [
    { label: '更新歷程', path: '/public/changelog', external: false },
    { label: '聯繫客服', path: '/public/support', external: false },
    { label: '遊戲下載', path: downloadUrl || '#', external: !!downloadUrl },
  ];

  const mainNav = [
    { label: '首頁', path: '/public' },
    { label: '最新消息', path: '/public/news' },
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
      <div className={styles.headerTop}>
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
                className={styles.logo}
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
              <>
                <span className={styles.headerTopUser}>{displayName}</span>
                <button className={styles.headerTopLink} onClick={handleLogout}>
                  登出
                </button>
              </>
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
