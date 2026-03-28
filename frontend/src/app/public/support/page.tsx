'use client';

import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import PublicFooter from '@/components/public/PublicFooter';

export default function SupportPage() {
  const { config } = useSiteConfig();
  const lineUrl = config?.settings.lineOfficialUrl;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Banner */}
      <div
        style={{
          paddingTop: 'calc(var(--header-total-height, 89px) + var(--announcement-bar-height, 0px) + 60px)',
          paddingBottom: 60,
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(20,20,32,1) 0%, #0a0a0a 100%)',
        }}
      >
        <h1
          style={{
            fontSize: 36,
            fontWeight: 300,
            letterSpacing: 4,
            color: '#fff',
            fontFamily: "'Georgia', serif",
            margin: 0,
          }}
        >
          聯繫客服
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 14,
            marginTop: 12,
            letterSpacing: 1,
          }}
        >
          如有任何問題，歡迎透過以下方式與我們聯繫
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
        }}
      >
        {/* Line Official Card */}
        {lineUrl ? (
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              width: '100%',
              maxWidth: 480,
              padding: '24px 32px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              textDecoration: 'none',
              transition: 'all 0.25s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(6,199,85,0.08)';
              e.currentTarget.style.borderColor = 'rgba(6,199,85,0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Line icon */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: '#06C755',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="#fff">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                LINE 官方帳號
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                點擊加入好友，即可與客服人員對話
              </div>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                color: 'rgba(255,255,255,0.3)',
                fontSize: 20,
              }}
            >
              &#10095;
            </div>
          </a>
        ) : (
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              padding: '40px 32px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
            }}
          >
            客服聯繫方式尚未設定
          </div>
        )}

        {/* QR Code */}
        {lineUrl && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 16,
                display: 'inline-block',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lineUrl)}`}
                alt="LINE QR Code"
                width={200}
                height={200}
                style={{ display: 'block' }}
              />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
              掃描 QR Code 加入官方 LINE
            </p>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}
