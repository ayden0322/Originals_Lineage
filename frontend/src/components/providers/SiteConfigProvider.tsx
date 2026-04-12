'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getPublicSiteConfig } from '@/lib/api/site-manage';
import type { PublicSiteConfig } from '@/lib/types';

interface SiteConfigContextType {
  config: PublicSiteConfig;
  loading: boolean;
}

const DEFAULT_CONFIG: PublicSiteConfig = {
  settings: {
    siteName: '始祖天堂',
    siteSlogan: '無盡傳奇再啟',
    siteDescription: '跨越時光，重返懷念的世界。事前預約、最新消息、線上商城一次掌握。',
    logoUrl: null,
    footerText: '始祖天堂 © 2026',
    heroEnabled: true,
    newsDisplayCount: 5,
    featuredArticleIds: [],
  },
  heroSlides: [],
  sections: [],
  featuredArticles: [],
};

const CACHE_KEY = 'publicSiteConfig:v1';

const SiteConfigContext = createContext<SiteConfigContextType>({
  config: DEFAULT_CONFIG,
  loading: true,
});

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

function readCache(): PublicSiteConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as PublicSiteConfig) : null;
  } catch {
    return null;
  }
}

function writeCache(config: PublicSiteConfig) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch {
    // quota / private mode — ignore
  }
}

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  // 初始永遠是 DEFAULT，避免 SSR/CSR hydration mismatch
  const [config, setConfig] = useState<PublicSiteConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Step 1: hydration 後立刻套用 localStorage 快取，首屏秒開
    const cached = readCache();
    if (cached && mounted) {
      setConfig(cached);
    }

    // Step 2: 背景打 API 拉最新值（stale-while-revalidate）
    getPublicSiteConfig()
      .then((fresh) => {
        if (!mounted) return;
        setConfig(fresh);
        writeCache(fresh);
      })
      .catch(() => {
        // API 失敗時維持 cache 或 default，不讓使用者卡住
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, loading }}>
      {children}
    </SiteConfigContext.Provider>
  );
}
