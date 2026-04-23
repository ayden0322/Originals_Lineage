'use client';

import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-tw';
import { themeConfig } from '@/theme/themeConfig';

// DatePicker 等元件依賴 dayjs 來產生月份/星期等字樣，需全域切到繁體中文
dayjs.locale('zh-tw');

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={zhTW} theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
}
