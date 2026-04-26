'use client';

import { forwardRef, memo, useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';

interface Props {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

interface PanelData {
  title: string;
  html: string;
}

interface StaticHtmlProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

// 只有 html / className / style 變動時才重新渲染。
// 若不隔離，父元件因 videoUrl state 變動 re-render，
// React 會把 dangerouslySetInnerHTML 的 innerHTML 重新覆寫，
// 導致 useEffect 後注入的 tab nav / panel / 影片 wrap 全部被清掉。
const StaticHtml = memo(
  forwardRef<HTMLDivElement, StaticHtmlProps>(function StaticHtml(
    { html, className, style },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }),
);

/**
 * 文章內容渲染器 — 把 [data-type="tabs"] 區塊接上互動切換
 *
 * 來源 HTML 形如：
 *   <div data-type="tabs" data-panels='[{"title":"X","html":"..."}]'></div>
 *
 * 也相容於人工撰寫的展開格式：
 *   <div data-type="tabs">
 *     <div data-type="tab-panel" data-title="X">...</div>
 *   </div>
 */
export default function ArticleTabsHydrator({ html, className, style }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const blocks = root.querySelectorAll<HTMLDivElement>('[data-type="tabs"]');
    const cleanups: Array<() => void> = [];

    blocks.forEach((block) => {
      // 避免重複初始化（HMR / re-hydrate）
      if (block.dataset.tabsInit === '1') return;

      // 1. 取得 panel 資料（優先 data-panels JSON，fallback 展開格式）
      let panels: PanelData[] = [];
      const json = block.getAttribute('data-panels');
      if (json) {
        try {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed)) panels = parsed;
        } catch {
          /* ignore */
        }
      }
      if (panels.length === 0) {
        block.querySelectorAll<HTMLDivElement>(':scope > [data-type="tab-panel"]').forEach(
          (p, i) => {
            panels.push({
              title: p.getAttribute('data-title') || `分頁 ${i + 1}`,
              html: p.innerHTML,
            });
          },
        );
      }
      if (panels.length === 0) return;

      block.dataset.tabsInit = '1';
      // 清空既有內容，重建
      block.replaceChildren();

      // 2. 建立導覽列
      const nav = document.createElement('ul');
      nav.className = 'article-tabs-nav';
      nav.setAttribute('role', 'tablist');

      // 3. 建立內容區
      const panelEls: HTMLDivElement[] = [];
      panels.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'article-tabs-nav-item';
        li.setAttribute('role', 'tab');
        li.dataset.tabIndex = String(i);
        li.tabIndex = 0;
        li.textContent = p.title || `分頁 ${i + 1}`;
        if (i === 0) li.classList.add('is-active');
        nav.appendChild(li);

        const panelEl = document.createElement('div');
        panelEl.className = 'article-tab-panel';
        panelEl.setAttribute('data-type', 'tab-panel');
        panelEl.setAttribute('data-title', p.title || '');
        panelEl.innerHTML = p.html || '';
        if (i !== 0) panelEl.style.display = 'none';
        panelEls.push(panelEl);
      });

      block.appendChild(nav);
      panelEls.forEach((el) => block.appendChild(el));

      const switchTo = (idx: number) => {
        nav
          .querySelectorAll<HTMLLIElement>('.article-tabs-nav-item')
          .forEach((item, i) => item.classList.toggle('is-active', i === idx));
        panelEls.forEach((p, i) => {
          p.style.display = i === idx ? '' : 'none';
        });
      };

      const onClick = (e: Event) => {
        const target = (e.target as HTMLElement).closest<HTMLLIElement>('.article-tabs-nav-item');
        if (!target) return;
        const idx = Number(target.dataset.tabIndex);
        if (!Number.isNaN(idx)) switchTo(idx);
      };

      const onKey = (e: KeyboardEvent) => {
        const target = (e.target as HTMLElement).closest<HTMLLIElement>('.article-tabs-nav-item');
        if (!target) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const idx = Number(target.dataset.tabIndex);
          if (!Number.isNaN(idx)) switchTo(idx);
        }
      };

      nav.addEventListener('click', onClick);
      nav.addEventListener('keydown', onKey);
      cleanups.push(() => {
        nav.removeEventListener('click', onClick);
        nav.removeEventListener('keydown', onKey);
        delete block.dataset.tabsInit;
      });
    });

    // ──── 影片圖片：把 img[data-video-url] 包成可點擊的 <span>，加上播放圖示 overlay
    // 點擊 → 開 Modal 播放 mp4
    const videoImgs = root.querySelectorAll<HTMLImageElement>('img[data-video-url]');
    videoImgs.forEach((img) => {
      const url = img.getAttribute('data-video-url');
      if (!url) return;
      // 已被包過就跳過（HMR / re-hydrate）
      if (img.parentElement?.classList.contains('article-video-image-wrap')) return;

      const wrap = document.createElement('span');
      wrap.className = 'article-video-image-wrap';
      wrap.setAttribute('role', 'button');
      wrap.tabIndex = 0;
      wrap.setAttribute('aria-label', '播放影片');

      // 把圖片從 cell 中拿出來，包進 wrap，再放回原位
      img.parentNode?.insertBefore(wrap, img);
      wrap.appendChild(img);

      const overlay = document.createElement('span');
      overlay.className = 'article-video-image-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      // 三角形播放圖示（尺寸由 CSS 控制，定位於圖片右下）
      overlay.innerHTML =
        '<svg viewBox="0 0 64 64" focusable="false">' +
        '<circle cx="32" cy="32" r="28" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.95)" stroke-width="3"/>' +
        '<polygon points="26,20 26,44 46,32" fill="#fff"/>' +
        '</svg>';
      wrap.appendChild(overlay);

      const open = (e: Event) => {
        e.preventDefault();
        setVideoUrl(url);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setVideoUrl(url);
        }
      };
      wrap.addEventListener('click', open);
      wrap.addEventListener('keydown', onKey);
      cleanups.push(() => {
        wrap.removeEventListener('click', open);
        wrap.removeEventListener('keydown', onKey);
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [html]);

  return (
    <>
      <StaticHtml ref={rootRef} html={html} className={className} style={style} />
      <Modal
        open={!!videoUrl}
        onCancel={() => setVideoUrl(null)}
        footer={null}
        width={960}
        centered
        destroyOnHidden
        styles={{ body: { padding: 0, background: '#000' } }}
      >
        {videoUrl && (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            autoPlay
            playsInline
            style={{ width: '100%', display: 'block', maxHeight: '80vh', background: '#000' }}
          />
        )}
      </Modal>
    </>
  );
}
