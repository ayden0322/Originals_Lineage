'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Announcement } from '@/lib/types';

/**
 * Top notification bar for urgent / maintenance announcements.
 * Auto-rotates if multiple. Dismiss with X.
 */

const TYPE_CONFIG: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  urgent: {
    bg: 'linear-gradient(90deg, rgba(139,0,0,0.95) 0%, rgba(100,0,0,0.9) 100%)',
    border: '#ff4d4f',
    icon: '⚠',
    label: '緊急公告',
  },
  maintenance: {
    bg: 'linear-gradient(90deg, rgba(196,162,78,0.15) 0%, rgba(196,162,78,0.08) 100%)',
    border: '#c4a24e',
    icon: '🔧',
    label: '維護通知',
  },
};

interface AnnouncementBarProps {
  announcements: Announcement[];
}

export default function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Filter urgent + maintenance only
  const items = announcements.filter(
    (a) => a.type === 'urgent' || a.type === 'maintenance',
  );

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
  const config = TYPE_CONFIG[announcement.type] || TYPE_CONFIG.maintenance;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        background: config.bg,
        borderBottom: `1px solid ${config.border}`,
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
      {/* Content */}
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
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          {current + 1}/{items.length}
        </span>
      )}

      {/* Arrows (if multiple) */}
      {items.length > 1 && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setCurrent((p) => (p - 1 + items.length) % items.length)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: 12,
              padding: '0 2px',
            }}
          >
            ‹
          </button>
          <button
            onClick={() => setCurrent((p) => (p + 1) % items.length)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: 12,
              padding: '0 2px',
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* Close */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '2px 4px',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
      >
        ✕
      </button>
    </div>
  );
}
