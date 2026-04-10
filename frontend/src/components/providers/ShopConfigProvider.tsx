'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getPublicShopConfig } from '@/lib/api/shop-manage';
import type { PublicShopConfig, ShopSettings } from '@/lib/types';

/** 與後端 DEFAULT_SHOP_SETTINGS 保持一致，作為 fallback 與型別保證 */
const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  heroEnabled: true,
  heroTitle: '無盡商城',
  heroSubtitle: '選購超值商品，開啟您的冒險之旅',
  heroBgImageUrl: null,
  heroHeight: 240,
  heroTextColor: '#ffffff',
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
