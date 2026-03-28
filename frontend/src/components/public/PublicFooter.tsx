'use client';

import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import styles from '@/app/public/styles/public.module.css';

export default function PublicFooter() {
  const { config } = useSiteConfig();

  return (
    <footer className={styles.footer}>
      {config?.settings.logoUrl ? (
        <img
          src={config.settings.logoUrl}
          alt=""
          className={styles.footerLogo}
        />
      ) : (
        <div className={styles.logoText} style={{ marginBottom: 16 }}>
          {config?.settings.siteName || '始祖天堂'}
        </div>
      )}
      <p className={styles.footerText}>
        {config?.settings.footerText || '始祖天堂 © 2026'}
      </p>
    </footer>
  );
}
