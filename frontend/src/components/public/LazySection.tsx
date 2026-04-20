'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';

interface LazySectionProps {
  id?: string;
  className?: string;
  children: ReactNode;
  /** 為 true 時初始即渲染（用於首個 section，避免首屏閃爍 / hydration mismatch） */
  eager?: boolean;
}

/**
 * 以 IntersectionObserver 控制子內容（Carousel 等重媒體）的掛載：
 * 在視口 ±100% 範圍外時卸載子節點 → 釋放 video decoder / 圖片記憶體；
 * 外層 <section> 仍維持 100vh 高度，scroll-snap 錨點不會亂跳。
 *
 * rootMargin="100% 0%" 意思：只要 section 上下 1 屏範圍內就視為「可見」，
 * 讓下一屏的媒體能提前掛載預熱，切換過去時不會看到黑屏。
 */
export default function LazySection({
  id,
  className,
  children,
  eager = false,
}: LazySectionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '100% 0%' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} id={id} className={className}>
      {visible ? children : null}
    </section>
  );
}
