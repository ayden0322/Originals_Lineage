'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/api/client';
import {
  getReserveStatus,
  createReservation,
  getMyRewards,
  type ReserveStatusResponse,
} from '@/lib/api/reserve';
import type { ReservationMilestone, MyReward } from '@/lib/types';
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
  const [myRewards, setMyRewards] = useState<MyReward[]>([]);
  const [detailMilestone, setDetailMilestone] = useState<ReservationMilestone | null>(null);

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

  // 已預約者載入個人獎勵清單
  useEffect(() => {
    if (!isLoggedIn) {
      setMyRewards([]);
      return;
    }
    if (!statusData?.myReservation?.reserved) {
      setMyRewards([]);
      return;
    }
    getMyRewards()
      .then(setMyRewards)
      .catch(() => setMyRewards([]));
  }, [isLoggedIn, statusData?.myReservation?.reserved]);

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
      setError('請先勾選同意參加新兵報到');
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
      <section
        className={styles.hero}
        style={
          ps?.heroBackgroundUrl
            ? {
                backgroundImage: `url(${ps.heroBackgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
              }
            : undefined
        }
      >
        <div
          className={styles.heroGradient}
          style={
            typeof ps?.heroOverlayOpacity === 'number'
              ? ({ '--hero-overlay-opacity': ps.heroOverlayOpacity } as React.CSSProperties)
              : undefined
          }
        />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {ps?.pageTitle || '新兵報到'}
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
                <span>已完成新兵報到</span>
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
                  <span>我同意參加新兵報到</span>
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

        {/* ─── 往下拉提示（只在有里程碑時顯示）──────────────── */}
        {milestones.length > 0 && (
          <button
            type="button"
            className={styles.scrollIndicator}
            onClick={() =>
              window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
            }
            aria-label="往下捲動查看報到獎勵"
          >
            <span className={styles.scrollHint}>往下拉，查看報到獎勵</span>
            <span className={styles.scrollArrow} aria-hidden>↓</span>
          </button>
        )}
      </section>

      {/* ─── 獎勵卡片區（精簡版，點擊開 modal）──────────────── */}
      {milestones.length > 0 && (
        <section className={styles.rewardsSection}>
          <h2 className={styles.sectionTitle}>預約獎勵</h2>
          <p className={styles.rewardsHint}>點擊卡片查看詳細獎勵內容</p>
          <div className={styles.rewardsGrid}>
            {milestones.map((m) => {
              const reached = (statusData?.displayCount ?? 0) >= m.threshold;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.rewardCard} ${reached ? styles.rewardReached : ''}`}
                  onClick={() => setDetailMilestone(m)}
                  aria-label={`查看 ${m.rewardName} 詳細內容`}
                >
                  {m.imageUrl ? (
                    <div className={styles.rewardImageWrap}>
                      <img
                        src={m.imageUrl}
                        alt={m.rewardName}
                        className={styles.rewardImage}
                      />
                      {reached && (
                        <div className={styles.rewardReachedOverlay}>✓</div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.rewardImagePlaceholder}>
                      {reached ? '✓' : '?'}
                    </div>
                  )}
                  <div className={styles.rewardInfo}>
                    <div className={styles.rewardName}>{m.rewardName}</div>
                    <div className={styles.rewardThreshold}>
                      @ {m.threshold.toLocaleString()} 人
                    </div>
                    {reached && (
                      <div className={styles.rewardReachedTag}>已達成</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 里程碑進度條（路線圖風格）──────────────────────── */}
      {milestones.length > 0 && (
        <section className={styles.milestoneSection}>
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

      {/* ─── 我的獎勵（已預約者）──────────────────────────────── */}
      {isReserved && myRewards.length > 0 && (
        <section className={styles.myRewardsSection}>
          <h2 className={styles.sectionTitle}>我的獎勵</h2>
          <p className={styles.myRewardsHint}>
            達成的里程碑獎勵會在此顯示；獎勵由工作人員透過遊戲內信件發送。
          </p>
          <div className={styles.myRewardsList}>
            {myRewards.map((r) => {
              const statusMeta = {
                pending: { label: '待發送', cls: styles.statusPending },
                sent: { label: '已發送', cls: styles.statusSent },
                failed: { label: '異常（請聯繫客服）', cls: styles.statusFailed },
              }[r.status];
              return (
                <div key={r.id} className={styles.myRewardItem}>
                  <div className={styles.myRewardName}>{r.rewardName}</div>
                  <div className={`${styles.myRewardStatus} ${statusMeta.cls}`}>
                    {statusMeta.label}
                  </div>
                  {r.sentAt && (
                    <div className={styles.myRewardSentAt}>
                      {new Date(r.sentAt).toLocaleString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
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

      {/* 獎勵詳細 Modal */}
      {detailMilestone && (
        <div
          className={styles.detailModalBackdrop}
          onClick={() => setDetailMilestone(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.detailModal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.detailClose}
              onClick={() => setDetailMilestone(null)}
              aria-label="關閉"
            >
              ×
            </button>
            {detailMilestone.imageUrl && (
              <div className={styles.detailImageWrap}>
                <img
                  src={detailMilestone.imageUrl}
                  alt={detailMilestone.rewardName}
                  className={styles.detailImage}
                />
              </div>
            )}
            <div className={styles.detailBody}>
              <div className={styles.detailThreshold}>
                達成 {detailMilestone.threshold.toLocaleString()} 人 解鎖
              </div>
              <h3 className={styles.detailName}>{detailMilestone.rewardName}</h3>
              {(statusData?.displayCount ?? 0) >= detailMilestone.threshold && (
                <div className={styles.detailReachedTag}>✓ 已達成</div>
              )}
              {detailMilestone.rewardDescription ? (
                <div
                  className={styles.detailDesc}
                  dangerouslySetInnerHTML={{
                    __html: detailMilestone.rewardDescription,
                  }}
                />
              ) : (
                <p className={styles.detailDescEmpty}>暫無詳細說明</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
