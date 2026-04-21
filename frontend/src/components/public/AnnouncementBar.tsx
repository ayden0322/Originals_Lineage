'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Announcement } from '@/lib/types';

/**
 * Top notification bar for urgent / maintenance announcements.
 * Auto-rotates if multiple. Dismiss with X.
 */

const TYPE_DEFAULTS: Record<string, { bg: string; border: string; label: string }> = {
  urgent: { bg: '#8b0000', border: '#ff4d4f', label: '緊急公告' },
  maintenance: { bg: '#7a6a2e', border: '#c4a24e', label: '維護通知' },
  event: { bg: '#1050c8', border: '#1677ff', label: '活動公告' },
  notice: { bg: '#1e6e3c', border: '#52c41a', label: '一般公告' },
};

interface AnnouncementBarProps {
  announcements: Announcement[];
}

export default function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const items = announcements;

  // Set CSS variable so header knows to push down
  useEffect(() => {
    const visible = items.length > 0 && !dismissed;
    document.documentElement.style.setProperty(
      '--announcement-bar-height',
      visible ? '40px' : '0px',
    );
    return () => {
      document.documentElement.style.setProperty('--announcement-bar-height', '0px');
    };
  }, [items.length, dismissed]);

  // Auto-rotate
  const next = useCallback(() => {
    if (items.length <= 1) return;
    setCurrent((prev) => (prev + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [items.length, next]);

  if (items.length === 0 || dismissed) return null;

  const announcement = items[current];
  const defaults = TYPE_DEFAULTS[announcement.type] || TYPE_DEFAULTS.notice;
  const config = {
    bg: announcement.barBgColor || defaults.bg,
    border: announcement.barBorderColor || defaults.border,
    label: defaults.label,
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        background: config.bg,
        border: `1px solid ${config.border}`,
        backdropFilter: 'blur(12px)',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '0 48px',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      {/* Type badge + Content */}
      <span
        style={{
          fontSize: 12,
          color: '#fff',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 3,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {config.label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          textAlign: 'center',
        }}
      >
        {announcement.title}
      </span>

      {/* Counter (if multiple) */}
      {items.length > 1 && (
        <span
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {current + 1}/{items.length}
        </span>
      )}

      {/* Arrows (if multiple) */}
      {items.length > 1 && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setCurrent((p) => (p - 1 + items.length) % items.length)}
            aria-label="上一則公告"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            ‹
          </button>
          <button
            onClick={() => setCurrent((p) => (p + 1) % items.length)}
            aria-label="下一則公告"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            ›
          </button>
        </div>
      )}

      {/* Close */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="關閉公告"
        style={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
          width: 36,
          height: 36,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
      >
        ✕
      </button>
    </div>
  );
}
