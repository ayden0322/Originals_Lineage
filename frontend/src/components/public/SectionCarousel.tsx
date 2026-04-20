'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CarouselSlide } from '@/lib/types';
import styles from '@/app/public/styles/public.module.css';

interface SectionCarouselProps {
  slides: CarouselSlide[];
}

// 為什麼要這樣做：
// 1) 原本把所有 slide 同時渲進 DOM、用 opacity 切換 → N 支 video 同時下載/解碼，首屏壓力爆表。
// 2) 改為只保留「當前 + 下一張預載 + 正在淡出的前一張」，同時存在最多 3 個媒體，fade 效果仍保留。
// 3) Video 用 preload="none"，只有「即將輪到」的才升級到 "metadata"，避免並發下載。
export default function SectionCarousel({ slides }: SectionCarouselProps) {
  const [current, setCurrent] = useState(0);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // 要掛載到 DOM 的 slide 索引集合（節流渲染的核心）
  const [mountedIndices, setMountedIndices] = useState<Set<number>>(() => {
    const s = new Set<number>();
    if (slides.length > 0) s.add(0);
    if (slides.length > 1) s.add(1);
    return s;
  });
  const prevCurrentRef = useRef(current);

  // current 變動時：把舊的留著做淡出，1.1s 後清掉；同時把下一張加入預載
  useEffect(() => {
    if (slides.length === 0) return;
    const prevIdx = prevCurrentRef.current;
    prevCurrentRef.current = current;

    setMountedIndices(() => {
      const s = new Set<number>();
      s.add(current);
      if (slides.length > 1) s.add((current + 1) % slides.length);
      if (prevIdx !== current) s.add(prevIdx); // 保留淡出中的前一張
      return s;
    });

    const timer = setTimeout(() => {
      setMountedIndices(() => {
        const s = new Set<number>();
        s.add(current);
        if (slides.length > 1) s.add((current + 1) % slides.length);
        return s;
      });
    }, 1100);
    return () => clearTimeout(timer);
  }, [current, slides.length]);

  // Auto-play with per-slide interval
  useEffect(() => {
    if (slides.length <= 1 && slides[0]?.mediaType !== 'video') {
      return;
    }
    const currentSlide = slides[current];
    if (!currentSlide) return;
    if (currentSlide.mediaType === 'video') return;

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
  }, [current, mountedIndices]);

  if (slides.length === 0) return null;

  const slide = slides[current];

  const handleClick = () => {
    if (slide.linkEnabled && slide.linkUrl) {
      window.open(slide.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {/* Background media — 只渲染目前掛載集合內的 slide */}
      {slides.map((s, i) => {
        if (!mountedIndices.has(i)) return null;
        const isCurrent = i === current;
        if (s.mediaType === 'video' && s.videoUrl) {
          return (
            <video
              key={s.id}
              ref={(el) => {
                if (el) videoRefs.current.set(i, el);
                else videoRefs.current.delete(i);
              }}
              className={styles.sectionBg}
              style={{
                objectFit: 'cover',
                opacity: isCurrent ? 1 : 0,
                cursor: s.linkEnabled && s.linkUrl ? 'pointer' : 'default',
              }}
              src={s.videoUrl}
              muted
              playsInline
              preload={isCurrent ? 'auto' : 'metadata'}
              loop={slides.length === 1}
              onEnded={() => {
                if (slides.length > 1) next();
              }}
              onClick={isCurrent ? handleClick : undefined}
            />
          );
        }
        return (
          <div
            key={s.id}
            className={styles.sectionBg}
            style={{
              backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : undefined,
              opacity: isCurrent ? 1 : 0,
              cursor: s.linkEnabled && s.linkUrl ? 'pointer' : 'default',
            }}
            onClick={isCurrent ? handleClick : undefined}
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
