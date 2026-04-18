'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getPublicPackageConfig } from '@/lib/api/package-manage';
import type { PublicPackageConfig, PackageSettings } from '@/lib/types';

/** 與後端 DEFAULT_PACKAGE_SETTINGS 保持一致 */
const DEFAULT_PACKAGE_SETTINGS: PackageSettings = {
  heroEnabled: true,
  heroTitle: '禮包內容',
  heroSubtitle: '用四海銀票，兌換精選禮包',
  heroBgImageUrl: null,
  heroHeight: 240,
  heroTextColor: '#ffffff',
  currencyName: '四海銀票',
  currencyIconUrl: null,
  currencyColor: '#c4a24e',
  cardColumns: 4,
  cardImageRatio: '1:1',
  cardBorderRadius: 12,
  cardBorderColor: 'transparent',
  accentColor: '#c4a24e',
};

interface PackageConfigContextType {
  config: PublicPackageConfig;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PackageConfigContext = createContext<PackageConfigContextType>({
  config: { settings: DEFAULT_PACKAGE_SETTINGS, packages: [] },
  loading: true,
  refresh: async () => {},
});

export function usePackageConfig() {
  return useContext(PackageConfigContext);
}

export function PackageConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicPackageConfig>({
    settings: DEFAULT_PACKAGE_SETTINGS,
    packages: [],
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const cfg = await getPublicPackageConfig();
      setConfig({
        settings: { ...DEFAULT_PACKAGE_SETTINGS, ...cfg.settings },
        packages: cfg.packages || [],
      });
    } catch {
      // fallback：API 失敗時保留預設值
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PackageConfigContext.Provider value={{ config, loading, refresh: load }}>
      {children}
    </PackageConfigContext.Provider>
  );
}
