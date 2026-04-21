'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SiteSection, SiteSettings } from '@/lib/types';
import styles from '@/app/public/styles/public.module.css';

interface SectionNavProps {
  sections: SiteSection[];
  navStyle?: Partial<SiteSettings>;
}

export default function SectionNav({ sections, navStyle }: SectionNavProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Default nav styles
  const activeColor = navStyle?.navActiveColor || '#ffffff';
  const inactiveColor = navStyle?.navInactiveColor || 'rgba(255,255,255,0.3)';
  const activeFontSize = navStyle?.navActiveFontSize || 24;
  const inactiveFontSize = navStyle?.navInactiveFontSize || 14;
  const activeFontWeight = navStyle?.navActiveFontWeight || '700';
  const inactiveFontWeight = navStyle?.navInactiveFontWeight || '400';
  const letterSpacing = navStyle?.navLetterSpacing || 2;
  const fontFamily = navStyle?.navFontFamily || "'Georgia', 'Times New Roman', serif";

  // Listen to scroll snap changes via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sections.findIndex((s) => s.slug === entry.target.id);
            if (idx >= 0) setActiveIndex(idx);
          }
        }
      },
      { threshold: 0.6 },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.slug);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = useCallback(
    (slug: string) => {
      const el = document.getElementById(slug);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
    [],
  );

  if (sections.length === 0) return null;

  return (
    <nav
      className={styles.sectionNav}
      style={
        {
          '--nav-active-color': activeColor,
          '--nav-inactive-color': inactiveColor,
        } as React.CSSProperties
      }
    >
      {sections.map((section, idx) => {
        const isActive = idx === activeIndex;
        return (
          <button
            key={section.id}
            className={`${styles.sectionNavItem} ${isActive ? styles.sectionNavItemActive : ''}`}
            onClick={() => handleClick(section.slug)}
            aria-label={section.displayName}
            aria-current={isActive ? 'true' : undefined}
          >
            <span
              className={styles.sectionNavText}
              style={{
                color: isActive ? activeColor : inactiveColor,
                fontSize: isActive ? `${activeFontSize}px` : `${inactiveFontSize}px`,
                fontWeight: isActive ? activeFontWeight : inactiveFontWeight,
                letterSpacing: `${letterSpacing}px`,
                fontFamily,
                opacity: isActive ? 1 : 0.5,
                transform: isActive ? 'translateX(0)' : 'translateX(-4px)',
                transition: 'all 0.4s ease',
              }}
            >
              {section.displayName}
            </span>
            <span className={styles.sectionNavDot} aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
