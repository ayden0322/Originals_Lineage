'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import { useArticleMusic } from '@/components/providers/ArticleMusicProvider';

/** 判斷是否為行動裝置 */
function isMobile(): boolean {
  if (typeof window === 'undefined') return true;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  ) || window.innerWidth < 768;
}

/** localStorage key */
const STORAGE_KEY_MUTED = 'bgm_muted';
const STORAGE_KEY_VOLUME = 'bgm_volume';

export default function BgmPlayer() {
  const pathname = usePathname();
  const { config } = useSiteConfig();
  const s = config?.settings;
  const { musicUrl: articleMusicUrl } = useArticleMusic();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 是否已嘗試過首次自動播放（避免重複綁定 listener） */
  const autoplayAttempted = useRef(false);

  // 初始靜音狀態：如果後台開了 autoPlay 且使用者沒有主動關過，預設不靜音
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [currentSrc, setCurrentSrc] = useState('');
  const [, setIsPlaying] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [mobile, setMobile] = useState(true);
  /** 等待使用者互動後自動播放 */
  const [waitingForInteraction, setWaitingForInteraction] = useState(false);

  // 初始化：讀取使用者偏好 + 偵測裝置 + 處理 autoPlay
  useEffect(() => {
    setMobile(isMobile());
    const savedMuted = localStorage.getItem(STORAGE_KEY_MUTED);
    const savedVol = localStorage.getItem(STORAGE_KEY_VOLUME);

    if (savedVol !== null) setVolume(parseFloat(savedVol));

    if (savedMuted !== null) {
      // 使用者曾經手動設定過 → 尊重使用者偏好
      setMuted(savedMuted === 'true');
    } else if (s?.bgmAutoPlay) {
      // 使用者從未設定過 + 後台開啟自動播放 → 預設不靜音
      setMuted(false);
    }
  }, [s?.bgmAutoPlay]);

  // 取得當前頁面的音樂 URL（文章音樂 > 頁面音樂 > 預設音樂）
  const getBgmUrl = useCallback((): string | null => {
    // 文章音樂最優先
    if (articleMusicUrl) return articleMusicUrl;
    if (!s) return null;
    const pageBgm = s.pageBgm;
    if (pageBgm && pageBgm[pathname] !== undefined) {
      return pageBgm[pathname];
    }
    return s.defaultBgm || null;
  }, [articleMusicUrl, s, pathname]);

  // 淡入淡出
  const fadeAudio = useCallback(
    (audio: HTMLAudioElement, from: number, to: number, duration: number, onDone?: () => void) => {
      if (fadeTimer.current) clearInterval(fadeTimer.current);
      const steps = 20;
      const stepTime = duration / steps;
      const stepValue = (to - from) / steps;
      let current = from;
      let step = 0;
      audio.volume = from;
      fadeTimer.current = setInterval(() => {
        step++;
        current += stepValue;
        audio.volume = Math.max(0, Math.min(1, current));
        if (step >= steps) {
          if (fadeTimer.current) clearInterval(fadeTimer.current);
          audio.volume = to;
          onDone?.();
        }
      }, stepTime);
    },
    [],
  );

  /** 嘗試播放音樂，如果被瀏覽器阻擋就等待使用者互動 */
  const tryPlay = useCallback(
    (audio: HTMLAudioElement) => {
      audio.play().then(() => {
        fadeAudio(audio, 0, volume, 800);
        setIsPlaying(true);
        setWaitingForInteraction(false);
      }).catch(() => {
        // 瀏覽器阻擋了自動播放 → 標記等待互動
        setIsPlaying(false);
        if (s?.bgmAutoPlay && !autoplayAttempted.current) {
          setWaitingForInteraction(true);
        }
      });
    },
    [fadeAudio, volume, s?.bgmAutoPlay],
  );

  // 路徑或設定變化時切換音樂（行動裝置跳過）
  useEffect(() => {
    if (mobile) return;
    const bgmUrl = getBgmUrl();

    // 沒有新音樂 → 維持目前播放，不中斷
    if (!bgmUrl) return;

    if (bgmUrl === currentSrc) return;

    const audio = audioRef.current || new Audio();
    audioRef.current = audio;

    const switchTrack = () => {
      audio.src = bgmUrl;
      audio.loop = true;
      audio.volume = 0;
      setCurrentSrc(bgmUrl);

      if (!muted) {
        tryPlay(audio);
      }
    };

    if (!audio.paused && currentSrc) {
      fadeAudio(audio, audio.volume, 0, 500, switchTrack);
    } else {
      switchTrack();
    }
  }, [pathname, s?.defaultBgm, s?.pageBgm, articleMusicUrl, muted, mobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // 使用者首次互動後自動播放（解決瀏覽器 autoplay 政策）
  useEffect(() => {
    if (!waitingForInteraction || mobile || autoplayAttempted.current) return;

    const handleInteraction = () => {
      autoplayAttempted.current = true;
      setWaitingForInteraction(false);

      const audio = audioRef.current;
      if (audio && audio.paused && currentSrc && !muted) {
        audio.play().then(() => {
          fadeAudio(audio, 0, volume, 800);
          setIsPlaying(true);
        }).catch(() => {});
      }

      // 清除所有 listener
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('scroll', handleInteraction);
    };

    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });
    document.addEventListener('scroll', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('scroll', handleInteraction);
    };
  }, [waitingForInteraction, mobile, currentSrc, muted, volume, fadeAudio]);

  // 音量 / 靜音同步
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // 預設音量從設定讀取
  useEffect(() => {
    if (s?.bgmVolume !== undefined && !localStorage.getItem(STORAGE_KEY_VOLUME)) {
      setVolume(s.bgmVolume);
    }
  }, [s?.bgmVolume]);

  /** 圖示是否顯示為靜音外觀（實際靜音 或 等待互動中都算） */
  const visualMuted = muted || waitingForInteraction;

  const toggleMute = () => {
    // 等待互動狀態下：使用者按了按鈕 → 直接播放音樂
    if (waitingForInteraction) {
      setWaitingForInteraction(false);
      autoplayAttempted.current = true;
      setMuted(false);
      localStorage.setItem(STORAGE_KEY_MUTED, 'false');
      const audio = audioRef.current;
      if (audio && currentSrc) {
        if (audio.paused) {
          audio.play().then(() => {
            fadeAudio(audio, 0, volume, 500);
            setIsPlaying(true);
          }).catch(() => {});
        } else {
          fadeAudio(audio, 0, volume, 300);
        }
      }
      return;
    }

    const next = !muted;
    setMuted(next);
    localStorage.setItem(STORAGE_KEY_MUTED, String(next));

    if (!next && audioRef.current) {
      const audio = audioRef.current;
      if (audio.paused && currentSrc) {
        audio.play().then(() => {
          fadeAudio(audio, 0, volume, 500);
          setIsPlaying(true);
        }).catch(() => {});
      } else {
        fadeAudio(audio, 0, volume, 300);
      }
    } else if (next && audioRef.current) {
      fadeAudio(audioRef.current, audioRef.current.volume, 0, 300);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
    if (muted && v > 0) {
      setMuted(false);
      localStorage.setItem(STORAGE_KEY_MUTED, 'false');
    }
  };

  // 行動裝置 or 沒有任何音樂設定 → 不顯示
  if (mobile) return null;
  const hasAnySiteMusic = s?.defaultBgm || (s?.pageBgm && Object.values(s.pageBgm).some((v) => !!v));
  if (!articleMusicUrl && !hasAnySiteMusic) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
      onMouseEnter={() => setShowVolume(true)}
      onMouseLeave={() => setShowVolume(false)}
    >
      {showVolume && (
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            borderRadius: 20,
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={visualMuted ? 0 : volume}
            onChange={handleVolumeChange}
            style={{
              width: 80,
              height: 4,
              accentColor: '#c4a24e',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 30 }}>
            {visualMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      )}

      <button
        onClick={toggleMute}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          color: visualMuted ? 'rgba(255,255,255,0.3)' : '#c4a24e',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          position: 'relative',
        }}
        title={visualMuted ? '開啟音樂' : '靜音'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
        {visualMuted && (
          <div
            style={{
              position: 'absolute',
              width: 32,
              height: 2,
              background: 'rgba(255,80,80,0.7)',
              transform: 'rotate(-45deg)',
              borderRadius: 2,
            }}
          />
        )}
      </button>
    </div>
  );
}
