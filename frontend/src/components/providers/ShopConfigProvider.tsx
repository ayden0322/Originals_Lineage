'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getPublicShopConfig } from '@/lib/api/shop-manage';
import type { PublicShopConfig, ShopSettings } from '@/lib/types';

/** 與後端 DEFAULT_SHOP_SETTINGS 保持一致，作為 fallback 與型別保證 */
const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  heroEnabled: true,
  heroTitle: '贊助支持',
  heroSubtitle: '選購四海銀票，支持伺服器營運',
  heroBgImageUrl: null,
  heroHeight: 240,
  heroTextColor: '#ffffff',
  currencyName: '四海銀票',
  currencyIconUrl: null,
  currencyColor: '#c4a24e',
  accentColor: '#c4a24e',
  bonusTiers: [
    { minAmount: 1000, ratio: 1.0 },
    { minAmount: 5000, ratio: 1.1 },
    { minAmount: 10000, ratio: 1.2 },
  ],
};

interface ShopConfigContextType {
  config: PublicShopConfig;
  loading: boolean;
}

const ShopConfigContext = createContext<ShopConfigContextType>({
  config: { settings: DEFAULT_SHOP_SETTINGS },
  loading: true,
});

export function useShopConfig() {
  return useContext(ShopConfigContext);
}

export function ShopConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicShopConfig>({
    settings: DEFAULT_SHOP_SETTINGS,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicShopConfig()
      .then((cfg) =>
        setConfig({
          // 後端理論上會回傳完整欄位，這裡再 merge 一次保證前端不會缺欄位
          settings: { ...DEFAULT_SHOP_SETTINGS, ...cfg.settings },
        }),
      )
      .catch(() => {
        // fallback：API 失敗時使用預設值，公開頁仍可正常顯示
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ShopConfigContext.Provider value={{ config, loading }}>
      {children}
    </ShopConfigContext.Provider>
  );
}
