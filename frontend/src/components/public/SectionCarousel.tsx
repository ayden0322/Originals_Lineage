'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CarouselSlide } from '@/lib/types';
import styles from '@/app/public/styles/public.module.css';

interface SectionCarouselProps {
  slides: CarouselSlide[];
}

export default function SectionCarousel({ slides }: SectionCarouselProps) {
  const [current, setCurrent] = useState(0);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-play with per-slide interval
  useEffect(() => {
    if (slides.length <= 1 && slides[0]?.mediaType !== 'video') {
      // Single image slide, no need to auto-advance
      return;
    }
    const currentSlide = slides[current];
    if (!currentSlide) return;

    // Video slides: let video play through, auto-advance on end
    if (currentSlide.mediaType === 'video') return;

    // Image slides: use per-slide autoPlaySeconds
    const ms = (currentSlide.autoPlaySeconds || 6) * 1000;
    const timer = setTimeout(next, ms);
    return () => clearTimeout(timer);
  }, [slides, current, next]);

  // When slide changes, play/pause videos
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (index === current) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [current]);

  if (slides.length === 0) return null;

  const slide = slides[current];

  // Handle click → open link in new tab
  const handleClick = () => {
    if (slide.linkEnabled && slide.linkUrl) {
      window.open(slide.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {/* Background media */}
      {slides.map((s, i) => {
        if (s.mediaType === 'video' && s.videoUrl) {
          return (
            <video
              key={s.id}
              ref={(el) => {
                if (el) videoRefs.current.set(i, el);
              }}
              className={styles.sectionBg}
              style={{
                objectFit: 'cover',
                opacity: i === current ? 1 : 0,
                cursor: s.linkEnabled && s.linkUrl ? 'pointer' : 'default',
              }}
              src={s.videoUrl}
              muted
              playsInline
              loop={slides.length === 1}
              onEnded={() => {
                if (slides.length > 1) next();
              }}
              onClick={i === current ? handleClick : undefined}
            />
          );
        }
        return (
          <div
            key={s.id}
            className={styles.sectionBg}
            style={{
              backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined,
              opacity: i === current ? 1 : 0,
              cursor: s.linkEnabled && s.linkUrl ? 'pointer' : 'default',
            }}
            onClick={i === current ? handleClick : undefined}
          />
        );
      })}
      <div
        className={styles.sectionOverlay}
        style={{
          cursor: slide.linkEnabled && slide.linkUrl ? 'pointer' : 'default',
        }}
        onClick={handleClick}
      />

      {/* Indicators */}
      {slides.length > 1 && (
        <div className={styles.indicators}>
          <button className={styles.indicatorArrow} onClick={prev}>
            &#10094;
          </button>
          {slides.map((_, i) => (
            <div
              key={i}
              className={`${styles.diamond} ${
                i === current ? styles.diamondActive : ''
              }`}
              onClick={() => setCurrent(i)}
            />
          ))}
          <button className={styles.indicatorArrow} onClick={next}>
            &#10095;
          </button>
        </div>
      )}
    </>
  );
}
