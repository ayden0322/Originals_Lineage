import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AntdProvider } from '@/components/providers/AntdProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { getPublicSiteConfigSSR } from '@/lib/api/server';
import './globals.css';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfigSSR();
  const siteName = config?.settings.siteName || '始祖天堂';
  const siteSlogan = config?.settings.siteSlogan || '無盡傳奇再啟';
  const siteDescription =
    config?.settings.siteDescription ||
    '跨越時光，重返懷念的世界。事前預約、最新消息、線上商城一次掌握。';
  const fullTitle = `${siteName}｜${siteSlogan}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: fullTitle,
      template: `%s｜${siteName}`,
    },
    description: `${siteName} — ${siteDescription}`,
    openGraph: {
      type: 'website',
      siteName,
      title: fullTitle,
      description: siteDescription,
      locale: 'zh_TW',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: siteDescription,
    },
  };
}

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
