'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getPublicSiteConfig } from '@/lib/api/site-manage';
import type { PublicSiteConfig } from '@/lib/types';

interface SiteConfigContextType {
  config: PublicSiteConfig | null;
  loading: boolean;
}

const SiteConfigContext = createContext<SiteConfigContextType>({
  config: null,
  loading: true,
});

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicSiteConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicSiteConfig()
      .then(setConfig)
      .catch(() => {
        // fallback defaults
        setConfig({
          settings: {
            siteName: '始祖天堂',
            logoUrl: null,
            footerText: '始祖天堂 © 2026',
            heroEnabled: true,
            newsDisplayCount: 5,
            featuredArticleIds: [],
          },
          heroSlides: [],
          sections: [],
          featuredArticles: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, loading }}>
      {children}
    </SiteConfigContext.Provider>
  );
}
