'use client';

import { ConfigProvider, theme } from 'antd';
import type { ReactNode } from 'react';

/**
 * 共用登入畫面外殼：統一暗色品牌風格（黑底 + 金色 accent）。
 * 包裝 Ant Design 暗色 theme，確保內部的 Input / Button / Form 自動套用。
 */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#c4a24e',
          colorBgBase: '#0a0a0a',
          colorTextBase: '#f5f5f5',
          borderRadius: 8,
          fontFamily:
            "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
        },
      }}
    >
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(196, 162, 78, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, rgba(196, 162, 78, 0.08) 0%, transparent 60%),
            #0a0a0a
          `,
          color: '#f5f5f5',
        }}
      >
        {/* Brand header */}
        <div
          style={{
            marginBottom: 32,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(22px, 5vw, 28px)',
              fontWeight: 700,
              letterSpacing: 6,
              color: '#c4a24e',
              fontFamily: "'Georgia', 'Times New Roman', serif",
              marginBottom: 4,
            }}
          >
            始祖天堂
          </div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 4,
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            LINEAGE
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            boxSizing: 'border-box',
            padding: 'clamp(24px, 6vw, 36px)',
            background: 'rgba(17, 17, 17, 0.85)',
            border: '1px solid rgba(196, 162, 78, 0.2)',
            borderRadius: 14,
            boxShadow:
              '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(196, 162, 78, 0.05)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <h1
            style={{
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 600,
              margin: '0 0 4px',
              color: '#f5f5f5',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                textAlign: 'center',
                fontSize: 13,
                color: 'rgba(255,255,255,0.5)',
                margin: '0 0 24px',
              }}
            >
              {subtitle}
            </p>
          )}
          {!subtitle && <div style={{ height: 20 }} />}
          {children}
        </div>

        {/* Footer link */}
        <div
          style={{
            marginTop: 32,
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          © 2026 始祖天堂
        </div>
      </div>
    </ConfigProvider>
  );
}
