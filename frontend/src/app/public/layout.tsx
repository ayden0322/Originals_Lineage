'use client';

import { ConfigProvider, theme } from 'antd';
import { SiteConfigProvider } from '@/components/providers/SiteConfigProvider';
import PublicHeader from '@/components/public/PublicHeader';
import AnnouncementSystem from '@/components/public/AnnouncementSystem';
import './styles/public-globals.css';
import styles from './styles/public.module.css';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#c4a24e',
          colorBgBase: '#0a0a0a',
          borderRadius: 8,
        },
      }}
    >
      <SiteConfigProvider>
        <div className={styles.publicLayout}>
          <AnnouncementSystem />
          <PublicHeader />
          <main>{children}</main>
        </div>
      </SiteConfigProvider>
    </ConfigProvider>
  );
}
