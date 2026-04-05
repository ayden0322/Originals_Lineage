'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface ArticleMusicState {
  /** 目前文章的音樂 URL（null = 沒有文章音樂） */
  musicUrl: string | null;
  /** 文章標題（顯示在播放器上） */
  articleTitle: string | null;
  /** 設定文章音樂（進入文章時呼叫） */
  setArticleMusic: (url: string | null, title?: string | null) => void;
}

const ArticleMusicContext = createContext<ArticleMusicState>({
  musicUrl: null,
  articleTitle: null,
  setArticleMusic: () => {},
});

export function ArticleMusicProvider({ children }: { children: React.ReactNode }) {
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState<string | null>(null);

  const setArticleMusic = useCallback((url: string | null, title?: string | null) => {
    setMusicUrl(url);
    setArticleTitle(title ?? null);
  }, []);

  return (
    <ArticleMusicContext.Provider value={{ musicUrl, articleTitle, setArticleMusic }}>
      {children}
    </ArticleMusicContext.Provider>
  );
}

export function useArticleMusic() {
  return useContext(ArticleMusicContext);
}
