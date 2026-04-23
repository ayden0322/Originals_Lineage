'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '@/lib/api/client';
import type { ApiResponse } from '@/lib/types';
import styles from './LineInviteFloat.module.css';

interface LineInviteConfig {
  enabled: boolean;
  inviteUrl: string;
  showQrCode: boolean;
  tooltip: string;
  inviteCaption?: string;
  tradingGroupUrl?: string;
  tradingGroupCaption?: string;
}

const MOBILE_BREAKPOINT = 768;

export default function LineInviteFloat() {
  const [config, setConfig] = useState<LineInviteConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);

  // 讀取設定
  useEffect(() => {
    let mounted = true;
    apiClient
      .get<ApiResponse<LineInviteConfig>>('/public/originals/line-invite')
      .then(({ data }) => {
        if (mounted) setConfig(data.data);
      })
      .catch(() => {
        if (mounted) setConfig(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // RWD 偵測
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 點外面關閉 popover（桌面版）
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (!popoverRef.current || !fabRef.current) return;
    const target = e.target as Node;
    if (popoverRef.current.contains(target) || fabRef.current.contains(target)) return;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const inviteUrl = config?.inviteUrl || '';
  const tradingUrl = config?.tradingGroupUrl || '';

  if (!config || !config.enabled || (!inviteUrl && !tradingUrl)) return null;

  const hasBoth = !!inviteUrl && !!tradingUrl;
  const primaryUrl = inviteUrl || tradingUrl;
  const inviteCaption = config.inviteCaption || '官方 LINE';
  const tradingCaption = config.tradingGroupCaption || '官方交易群';

  const handleToggle = () => setOpen((v) => !v);
  const handleOpenLink = () => {
    window.open(primaryUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className={styles.fab}
        aria-label={config.tooltip || '加入官方 LINE'}
        title={config.tooltip || '加入官方 LINE'}
        onClick={handleToggle}
      >
        <LineIcon />
      </button>

      {open && isMobile && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      {open && (
        <div
          ref={popoverRef}
          className={`${styles.popover} ${hasBoth && !isMobile ? styles.popoverWide : ''} ${isMobile ? styles.popoverMobile : ''}`}
          role="dialog"
          aria-label="LINE 好友邀請"
        >
          <div className={styles.popoverHeader}>
            <span className={styles.popoverTitle}>{config.tooltip || '加入官方 LINE'}</span>
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="關閉"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className={styles.popoverBody}>
            {config.showQrCode && (
              hasBoth ? (
                <div className={styles.qrRow}>
                  <a
                    className={styles.qrItem}
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className={styles.qrBox}>
                      <QRCodeSVG
                        value={inviteUrl}
                        size={isMobile ? 130 : 150}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                        includeMargin={false}
                      />
                    </div>
                    <p className={styles.qrCaption}>{inviteCaption}</p>
                  </a>
                  <a
                    className={styles.qrItem}
                    href={tradingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className={styles.qrBox}>
                      <QRCodeSVG
                        value={tradingUrl}
                        size={isMobile ? 130 : 150}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                        includeMargin={false}
                      />
                    </div>
                    <p className={styles.qrCaption}>{tradingCaption}</p>
                  </a>
                </div>
              ) : (
                <a
                  className={styles.qrBox}
                  href={primaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <QRCodeSVG
                    value={primaryUrl}
                    size={isMobile ? 180 : 200}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                    includeMargin={false}
                  />
                  <p className={styles.qrHint}>
                    {inviteUrl ? inviteCaption : tradingCaption}
                  </p>
                </a>
              )
            )}

            <button type="button" className={styles.inviteBtn} onClick={handleOpenLink}>
              <LineIcon size={18} />
              <span>點擊加入好友</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 使用 LINE 官方風格的白色「LINE」字樣 + 聊天泡泡剪影。
 * 底色由 .fab / .inviteBtn 的 background 提供（LINE 品牌綠 #06C755）。
 */
function LineIcon({ size = 26 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M16 4C8.82 4 3 8.68 3 14.44c0 5.16 4.6 9.48 10.82 10.3.42.09.99.28 1.14.64.13.33.08.85.04 1.18l-.18 1.12c-.06.33-.26 1.3 1.14.71 1.4-.59 7.56-4.45 10.32-7.63 1.9-2.08 2.72-4.2 2.72-6.32C29 8.68 23.18 4 16 4z"
      />
    </svg>
  );
}
