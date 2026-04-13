'use client';

import { useRef, useEffect } from 'react';
import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import SectionCarousel from '@/components/public/SectionCarousel';
import SectionNav from '@/components/public/SectionNav';
import NewsPreview from '@/components/public/NewsPreview';
import PublicFooter from '@/components/public/PublicFooter';
import styles from './styles/public.module.css';

export default function HomePage() {
  const { config, loading } = useSiteConfig();
  const { settings, sections, featuredArticles } = config;
  const snapRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // 資料載入完成後，強制 scroll 回第一個 section
  useEffect(() => {
    if (!loading && sections.length > 0 && !hasScrolled.current) {
      hasScrolled.current = true;
      requestAnimationFrame(() => {
        snapRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      });
    }
  }, [loading, sections.length]);

  return (
    <>
      {/* Left side fixed section navigation */}
      {sections.length > 0 && (
        <SectionNav sections={sections} navStyle={settings} />
      )}

      {/* Snap scroll container */}
      <div ref={snapRef} className={styles.snapContainer}>
        {/* All sections - each one fills 100vh */}
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.slug}
            className={styles.snapSection}
          >
            {/* Background: carousel slides or fallback gradient */}
            {section.slides.length > 0 ? (
              <SectionCarousel slides={section.slides} />
            ) : (
              <>
                <div
                  className={styles.sectionBg}
                  style={{
                    background:
                      'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    opacity: 1,
                  }}
                />
                <div className={styles.sectionOverlay} />
              </>
            )}

            {/* Rich text description overlay — always on top of carousel */}
            {section.description && (
              <div
                className={styles.sectionContent}
                dangerouslySetInnerHTML={{ __html: section.description }}
              />
            )}
          </section>
        ))}

        {/* News + Footer section (not snap, normal flow) */}
        <div className={styles.snapSectionAuto}>
          {/* News Preview */}
          {featuredArticles.length > 0 && (
            <NewsPreview articles={featuredArticles} />
          )}

          {/* Footer */}
          <PublicFooter />
        </div>
      </div>
    </>
  );
}
