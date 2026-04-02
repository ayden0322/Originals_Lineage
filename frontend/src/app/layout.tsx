import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AntdProvider } from '@/components/providers/AntdProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '始祖天堂平台',
  description: '始祖天堂遊戲管理平台',
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
