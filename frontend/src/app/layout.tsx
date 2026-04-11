import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AntdProvider } from '@/components/providers/AntdProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import './globals.css';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '始祖天堂｜無盡傳奇再啟',
    template: '%s｜始祖天堂',
  },
  description: '始祖天堂 — 跨越時光，重返懷念的世界。事前預約、最新消息、線上商城一次掌握。',
  openGraph: {
    type: 'website',
    siteName: '始祖天堂',
    title: '始祖天堂｜無盡傳奇再啟',
    description: '跨越時光，重返懷念的世界。事前預約、最新消息、線上商城一次掌握。',
    locale: 'zh_TW',
  },
  twitter: {
    card: 'summary_large_image',
    title: '始祖天堂｜無盡傳奇再啟',
    description: '跨越時光，重返懷念的世界。',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>
        <AntdRegistry>
          <AntdProvider>
            <AuthProvider>{children}</AuthProvider>
          </AntdProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
