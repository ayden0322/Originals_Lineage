'use client';

import { ConfigProvider, theme } from 'antd';
import { SiteConfigProvider, useSiteConfig } from '@/components/providers/SiteConfigProvider';
import PublicHeader from '@/components/public/PublicHeader';
import AnnouncementSystem from '@/components/public/AnnouncementSystem';
import BgmPlayer from '@/components/public/BgmPlayer';
import { ArticleMusicProvider } from '@/components/providers/ArticleMusicProvider';
import { useEffect } from 'react';
import { extractGoogleFontNames, buildGoogleFontsUrl } from '@/lib/fonts';
import './styles/public-globals.css';
import styles from './styles/public.module.css';

/** 根據後台設定動態覆蓋 CSS 變數 + 載入 Google Fonts */
function ThemeInjector({ children }: { children: React.ReactNode }) {
  const { config } = useSiteConfig();
  const s = config?.settings;

  // 動態載入 Google Fonts
  useEffect(() => {
    if (!s) return;
    const fontNames = extractGoogleFontNames([s.headingFontFamily, s.bodyFontFamily]);
    const url = buildGoogleFontsUrl(fontNames);
    if (!url) return;

    const linkId = 'dynamic-google-fonts';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = url;

    return () => {
      link?.remove();
    };
  }, [s?.headingFontFamily, s?.bodyFontFamily]);

  // 注入 CSS 變數（色彩 + 字體）
  useEffect(() => {
    if (!s) return;
    const root = document.documentElement;
    const map: Record<string, string | undefined> = {
      // 色彩
      '--accent-gold': s.accentColor,
      '--accent-gold-light': s.accentColorLight,
      '--header-bg-color': s.headerBgColor,
      '--bg-primary': s.bgPrimary,
      '--bg-secondary': s.bgSecondary,
      '--text-primary': s.textPrimary,
      '--text-secondary': s.textSecondary,
      '--footer-bg-color': s.footerBgColor,
      '--footer-text-color': s.footerTextColor,
      // 字體
      '--font-heading': s.headingFontFamily,
      '--font-body': s.bodyFontFamily,
      // 文字縮放
      '--font-scale': String(s.fontScale ?? 1),
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
  const bodyFont = s?.bodyFontFamily || 'sans-serif';

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: accentColor,
          colorBgBase: bgBase,
          borderRadius: 8,
          fontFamily: bodyFont,
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
      <ArticleMusicProvider>
        <ThemeInjector>
          <div className={styles.publicLayout}>
            <AnnouncementSystem />
            <PublicHeader />
            <main>{children}</main>
            <BgmPlayer />
          </div>
        </ThemeInjector>
      </ArticleMusicProvider>
    </SiteConfigProvider>
  );
}
