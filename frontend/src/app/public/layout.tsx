'use client';

import { ConfigProvider, theme } from 'antd';
import { SiteConfigProvider, useSiteConfig } from '@/components/providers/SiteConfigProvider';
import PublicHeader from '@/components/public/PublicHeader';
import AnnouncementSystem from '@/components/public/AnnouncementSystem';
import { useEffect } from 'react';
import './styles/public-globals.css';
import styles from './styles/public.module.css';

/** 根據後台設定動態覆蓋 CSS 變數 */
function ThemeInjector({ children }: { children: React.ReactNode }) {
  const { config } = useSiteConfig();
  const s = config?.settings;

  useEffect(() => {
    if (!s) return;
    const root = document.documentElement;
    const map: Record<string, string | undefined> = {
      '--accent-gold': s.accentColor,
      '--accent-gold-light': s.accentColorLight,
      '--header-bg-color': s.headerBgColor,
      '--bg-primary': s.bgPrimary,
      '--bg-secondary': s.bgSecondary,
      '--text-primary': s.textPrimary,
      '--text-secondary': s.textSecondary,
      '--footer-bg-color': s.footerBgColor,
      '--footer-text-color': s.footerTextColor,
    };
    Object.entries(map).forEach(([prop, value]) => {
      if (value) {
        root.style.setProperty(prop, value);
      }
    });
    return () => {
      Object.keys(map).forEach((prop) => {
        root.style.removeProperty(prop);
      });
    };
  }, [s]);

  const accentColor = s?.accentColor || '#c4a24e';
  const bgBase = s?.bgPrimary || '#0a0a0a';

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: accentColor,
          colorBgBase: bgBase,
          borderRadius: 8,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteConfigProvider>
      <ThemeInjector>
        <div className={styles.publicLayout}>
          <AnnouncementSystem />
          <PublicHeader />
          <main>{children}</main>
        </div>
      </ThemeInjector>
    </SiteConfigProvider>
  );
}
