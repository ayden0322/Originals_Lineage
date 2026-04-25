'use client';

import { useEffect, useRef } from 'react';

interface Props {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

interface PanelData {
  title: string;
  html: string;
}

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

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [html]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
