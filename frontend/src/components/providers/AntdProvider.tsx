'use client';

import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { themeConfig } from '@/theme/themeConfig';

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={zhTW} theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
}
