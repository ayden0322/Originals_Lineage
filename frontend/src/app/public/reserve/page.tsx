'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/api/client';
import {
  getReserveStatus,
  createReservation,
  type ReserveStatusResponse,
} from '@/lib/api/reserve';
import type { ReservationMilestone } from '@/lib/types';
import PublicFooter from '@/components/public/PublicFooter';
import styles from './reserve.module.css';

// ─── Countdown Hook ──────────────────────────────────────────

interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function useCountdown(targetDate: string | null | undefined): CountdownValues {
  const [time, setTime] = useState<CountdownValues>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;

    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    };

    setTime(calc());
    const interval = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return time;
}

// ─── CountUp Animation Hook ─────────────────────────────────

function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }

    startRef.current = null;

    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

// ─── Main Component ─────────────────────────────────────────

export default function ReservePage() {
  const router = useRouter();
  const [statusData, setStatusData] = useState<ReserveStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [justReserved, setJustReserved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 延遲判斷登入狀態，避免 SSR hydration mismatch
  useEffect(() => {
    setIsLoggedIn(!!getAccessToken('player'));
  }, []);

  // 取得狀態
  const fetchStatus = useCallback(async () => {
    try {
      const data = await getReserveStatus();
      setStatusData(data);
    } catch {
      // API 可能尚未部署，靜默處理
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const countdown = useCountdown(statusData?.pageSettings?.deadlineAt);
  const animatedCount = useCountUp(statusData?.displayCount ?? 0);

  const hasDeadline = !!statusData?.pageSettings?.deadlineAt;
  const isLocked = !!statusData?.pageSettings?.isDistributionLocked;
  const isReserved = !!statusData?.myReservation?.reserved;
  const milestones = statusData?.milestones ?? [];
  const ps = statusData?.pageSettings;

  // 最高里程碑作為進度條終點
  const maxThreshold = milestones.length > 0
    ? Math.max(...milestones.map((m) => m.threshold))
    : 0;

  // 處理預約
  const handleReserve = async () => {
    if (!isLoggedIn) {
      router.push('/auth/login?redirect=/public/reserve');
      return;
    }
    if (!agreed) {
      setError('請先勾選同意參加事前預約');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createReservation();
      setJustReserved(true);
      await fetchStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || '預約失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.reservePage}>
      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {ps?.pageTitle || '事前預約'}
          </h1>
          {ps?.pageSubtitle && (
            <p className={styles.heroSubtitle}>{ps.pageSubtitle}</p>
          )}
          {ps?.pageDescription && (
            <div
              className={styles.heroDesc}
              dangerouslySetInnerHTML={{ __html: ps.pageDescription }}
            />
          )}

          {/* 倒數計時 */}
          {hasDeadline && (
            <div className={styles.countdown}>
              {[
                { value: countdown.days, label: '天' },
                { value: countdown.hours, label: '時' },
                { value: countdown.minutes, label: '分' },
                { value: countdown.seconds, label: '秒' },
              ].map((item) => (
                <div key={item.label} className={styles.countdownItem}>
                  <span className={styles.countdownValue}>
                    {String(item.value).padStart(2, '0')}
                  </span>
                  <span className={styles.countdownLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* 人數計數器 */}
          <div className={styles.counter}>
            <span>已有</span>
            <span className={styles.counterNumber}>
              {animatedCount.toLocaleString()}
            </span>
            <span>人預約</span>
          </div>

          {/* 預約操作區 */}
          <div className={styles.actionArea}>
            {isReserved || justReserved ? (
              <div className={styles.reservedBadge}>
                <span className={styles.reservedIcon}>✓</span>
                <span>已完成事前預約</span>
                {statusData?.myReservation?.gameAccountName && (
                  <span className={styles.reservedAccount}>
                    {statusData.myReservation.gameAccountName}
                  </span>
                )}
              </div>
            ) : isLocked ? (
              <div className={styles.closedBadge}>預約活動已結束</div>
            ) : !isLoggedIn ? (
              <>
                <p className={styles.loginHint}>需登入遊戲帳號才能參與</p>
                <button
                  className={styles.btnOutlined}
                  onClick={() => router.push('/auth/login?redirect=/public/reserve')}
                >
                  登入後預約
                </button>
              </>
            ) : (
              <>
                <label className={styles.agreeLabel}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className={styles.agreeCheckbox}
                  />
                  <span>我同意參加事前預約</span>
                </label>
                {error && <div className={styles.errorMsg}>{error}</div>}
                <button
                  className={styles.btnPrimary}
                  onClick={handleReserve}
                  disabled={loading || !agreed}
                >
                  {loading ? '送出中...' : '立即預約'}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ─── 獎勵卡片區 ──────────────────────────────────────── */}
      {milestones.length > 0 && (
        <section className={styles.rewardsSection}>
          <h2 className={styles.sectionTitle}>預約獎勵</h2>
          <div className={styles.rewardsGrid}>
            {milestones.map((m) => {
              const reached = (statusData?.displayCount ?? 0) >= m.threshold;
              return (
                <div
                  key={m.id}
                  className={`${styles.rewardCard} ${reached ? styles.rewardReached : ''}`}
                >
                  {m.imageUrl && (
                    <div className={styles.rewardImageWrap}>
                      <img
                        src={m.imageUrl}
                        alt={m.rewardName}
                        className={styles.rewardImage}
                      />
                      {reached && <div className={styles.rewardReachedOverlay}>✓</div>}
                    </div>
                  )}
                  <div className={styles.rewardInfo}>
                    <div className={styles.rewardName}>{m.rewardName}</div>
                    <div className={styles.rewardThreshold}>
                      @ {m.threshold.toLocaleString()} 人
                    </div>
                    {m.rewardDescription && (
                      <div
                        className={styles.rewardDesc}
                        dangerouslySetInnerHTML={{ __html: m.rewardDescription }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 里程碑進度條（路線圖風格）──────────────────────── */}
      {milestones.length > 0 && (
        <section className={styles.milestoneSection}>
          <h2 className={styles.sectionTitle}>里程碑進度</h2>
          <div className={styles.milestoneTrack}>
            {milestones.map((m, index) => {
              const displayCount = statusData?.displayCount ?? 0;
              const reached = displayCount >= m.threshold;
              const prevThreshold = index > 0 ? milestones[index - 1].threshold : 0;

              // 計算當前區段的填充比例
              let segmentProgress = 0;
              if (reached) {
                segmentProgress = 1;
              } else if (displayCount > prevThreshold) {
                segmentProgress = Math.min(
                  (displayCount - prevThreshold) / (m.threshold - prevThreshold),
                  1,
                );
              }

              const isCurrentSegment = !reached && displayCount > prevThreshold;

              return (
                <div key={m.id} className={styles.milestoneNode}>
                  {/* 連接軌道（第一個節點不顯示左側軌道） */}
                  {index > 0 && (
                    <div className={styles.milestoneRail}>
                      <div
                        className={`${styles.milestoneRailFill} ${reached ? styles.railReached : ''}`}
                        style={{ width: `${segmentProgress * 100}%` }}
                      />
                    </div>
                  )}

                  {/* 節點圓形 */}
                  <div
                    className={`${styles.milestoneCircle} ${
                      reached
                        ? styles.circleReached
                        : isCurrentSegment
                          ? styles.circleCurrent
                          : styles.circlePending
                    }`}
                  >
                    {reached ? '✓' : ''}
                  </div>

                  {/* 目前進度浮標 */}
                  {isCurrentSegment && (
                    <div className={styles.progressFloater}>
                      目前 {displayCount.toLocaleString()} 人
                    </div>
                  )}

                  {/* 節點資訊 */}
                  <div className={styles.milestoneLabel}>
                    <div className={styles.milestoneThreshold}>
                      {m.threshold.toLocaleString()} 人
                    </div>
                    <div className={styles.milestoneName}>{m.rewardName}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <PublicFooter />

      {/* 預約成功慶祝動畫 overlay */}
      {justReserved && (
        <div
          className={styles.celebrateOverlay}
          onAnimationEnd={() => setJustReserved(false)}
        />
      )}
    </div>
  );
}
