'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSiteConfig } from '@/components/providers/SiteConfigProvider';
import {
  createReservation,
  getReservationCount,
  getPublicMilestones,
  verifyReservationEmail,
  resendVerificationEmail,
} from '@/lib/api/reserve';
import type { ReservationMilestone, ReserveFieldConfig } from '@/lib/types';
import PublicFooter from '@/components/public/PublicFooter';
import styles from './reserve.module.css';

interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function useCountdown(targetDate: string | undefined): CountdownValues {
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

export default function ReservePage() {
  const router = useRouter();
  const { config } = useSiteConfig();
  const s = config?.settings;

  const accentColor = s?.reserveAccentColor || '#c4a24e';
  const fieldConfig: ReserveFieldConfig = s?.reserveFieldConfig || {
    displayName: { visible: true, required: false },
    phone: { visible: true, required: false },
    lineId: { visible: true, required: false },
  };

  const countdown = useCountdown(s?.reserveLaunchDate);

  const [count, setCount] = useState(0);
  const [milestones, setMilestones] = useState<ReservationMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Verification state
  const [showVerify, setShowVerify] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  const fetchInitData = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        getReservationCount(),
        s?.reserveMilestonesEnabled ? getPublicMilestones() : Promise.resolve([]),
      ]);
      setCount(c);
      setMilestones(m);
    } catch {
      // ignore
    }
  }, [s?.reserveMilestonesEnabled]);

  useEffect(() => {
    fetchInitData();
  }, [fetchInitData]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(cooldownRef.current);
    }
  }, [resendCooldown]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = '請輸入電子信箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = '請輸入有效的電子信箱';
    }

    if (fieldConfig.displayName?.visible && fieldConfig.displayName?.required && !displayName.trim()) {
      errors.displayName = '請輸入暱稱';
    }
    if (fieldConfig.phone?.visible && fieldConfig.phone?.required && !phone.trim()) {
      errors.phone = '請輸入手機號碼';
    }
    if (fieldConfig.lineId?.visible && fieldConfig.lineId?.required && !lineId.trim()) {
      errors.lineId = '請輸入 LINE ID';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const dto: { email: string; displayName?: string; phone?: string; lineId?: string } = { email: email.trim() };
      if (fieldConfig.displayName?.visible && displayName.trim()) dto.displayName = displayName.trim();
      if (fieldConfig.phone?.visible && phone.trim()) dto.phone = phone.trim();
      if (fieldConfig.lineId?.visible && lineId.trim()) dto.lineId = lineId.trim();

      await createReservation(dto);
      setCount((prev) => prev + 1);

      if (s?.reserveEmailVerificationEnabled) {
        setVerifyEmail(email.trim());
        setShowVerify(true);
        setResendCooldown(60);
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error?.response?.data?.message || '預約失敗，請稍後再試';
      setFormErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
    setVerifyLoading(true);
    try {
      await verifyReservationEmail(verifyEmail, verifyCode);
      setShowVerify(false);
      setSubmitted(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormErrors({ verify: error?.response?.data?.message || '驗證失敗' });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerificationEmail(verifyEmail);
      setResendCooldown(60);
    } catch {
      // ignore
    }
  };

  // ─── CSS Variable for accent color ──────────────────────────

  const cssVars = {
    '--reserve-accent': accentColor,
  } as React.CSSProperties;

  const hasCountdown = !!s?.reserveLaunchDate;
  const showMilestones = s?.reserveMilestonesEnabled && milestones.length > 0;

  // ─── Success state ──────────────────────────────────────────

  if (submitted) {
    const successMsg =
      s?.reserveSuccessMessage || '感謝您的事前預約，我們將在開服前通知您。請留意您的信箱。';

    return (
      <div className={styles.reservePage} style={cssVars}>
        <div className={styles.hero}>
          {s?.reserveBannerUrl && (
            <div
              className={styles.heroBg}
              style={{ backgroundImage: `url(${s.reserveBannerUrl})` }}
            />
          )}
          <div className={styles.heroContent}>
            <div className={styles.successOverlay}>
              <div className={styles.successIcon}>&#10003;</div>
              <div className={styles.successTitle}>預約成功！</div>
              <div className={styles.successDesc}>{successMsg}</div>
              <button
                className={styles.successButton}
                onClick={() => router.push('/public')}
              >
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main page ──────────────────────────────────────────────

  return (
    <div
      className={styles.reservePage}
      style={{
        ...cssVars,
        ...(s?.reserveBgImageUrl
          ? {
              backgroundImage: `url(${s.reserveBgImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }
          : {}),
      }}
    >
      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className={styles.hero}>
        {s?.reserveBannerUrl && (
          <div
            className={styles.heroBg}
            style={{ backgroundImage: `url(${s.reserveBannerUrl})` }}
          />
        )}
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {s?.reserveTitle || '事前預約'}
          </h1>
          {s?.reserveSubtitle && (
            <p className={styles.heroSubtitle}>{s.reserveSubtitle}</p>
          )}
          {s?.reserveDescription && (
            <p className={styles.heroDesc}>{s.reserveDescription}</p>
          )}

          {/* Countdown */}
          {hasCountdown && (
            <div className={styles.countdown}>
              {[
                { value: countdown.days, label: '天' },
                { value: countdown.hours, label: '時' },
                { value: countdown.minutes, label: '分' },
                { value: countdown.seconds, label: '秒' },
              ].map((item) => (
                <div key={item.label} className={styles.countdownItem}>
                  <span className={styles.countdownValue} style={{ color: accentColor }}>
                    {String(item.value).padStart(2, '0')}
                  </span>
                  <span className={styles.countdownLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Counter */}
          <div className={styles.counter}>
            <span>已有</span>
            <span className={styles.counterNumber} style={{ color: accentColor }}>
              {count.toLocaleString()}
            </span>
            <span>人預約</span>
          </div>
        </div>
      </section>

      {/* ─── Milestones ──────────────────────────────────────── */}
      {showMilestones && (
        <section className={styles.milestones}>
          <h2 className={styles.milestonesTitle}>預約里程碑獎勵</h2>
          <div className={styles.milestoneTrack}>
            {milestones.map((m) => {
              const reached = count >= m.threshold;
              return (
                <div
                  key={m.id}
                  className={`${styles.milestoneItem} ${reached ? styles.milestoneReached : styles.milestonePending}`}
                >
                  <div
                    className={styles.milestoneIcon}
                    style={{
                      borderColor: accentColor,
                      backgroundColor: reached ? accentColor : 'transparent',
                      color: reached ? '#000' : accentColor,
                    }}
                  >
                    {reached ? '✓' : m.threshold}
                  </div>
                  <div className={styles.milestoneInfo}>
                    <div className={styles.milestoneThreshold}>
                      {m.threshold.toLocaleString()} 人達成
                    </div>
                    <div className={styles.milestoneReward}>{m.rewardName}</div>
                  </div>
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt={m.rewardName}
                      className={styles.milestoneImage}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Form ────────────────────────────────────────────── */}
      <section className={styles.formSection}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>
            {s?.reserveButtonText || '立即預約'}
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Email (always shown) */}
            <div className={styles.formGroup}>
              <label className={`${styles.formLabel} ${styles.formRequired}`}>
                電子信箱
              </label>
              <input
                type="email"
                className={styles.formInput}
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {formErrors.email && (
                <div className={styles.formError}>{formErrors.email}</div>
              )}
            </div>

            {/* Display Name */}
            {fieldConfig.displayName?.visible && (
              <div className={styles.formGroup}>
                <label
                  className={`${styles.formLabel} ${fieldConfig.displayName.required ? styles.formRequired : ''}`}
                >
                  暱稱
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="您的暱稱"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                {formErrors.displayName && (
                  <div className={styles.formError}>{formErrors.displayName}</div>
                )}
              </div>
            )}

            {/* Phone */}
            {fieldConfig.phone?.visible && (
              <div className={styles.formGroup}>
                <label
                  className={`${styles.formLabel} ${fieldConfig.phone.required ? styles.formRequired : ''}`}
                >
                  手機號碼
                </label>
                <input
                  type="tel"
                  className={styles.formInput}
                  placeholder="09xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {formErrors.phone && (
                  <div className={styles.formError}>{formErrors.phone}</div>
                )}
              </div>
            )}

            {/* LINE ID */}
            {fieldConfig.lineId?.visible && (
              <div className={styles.formGroup}>
                <label
                  className={`${styles.formLabel} ${fieldConfig.lineId.required ? styles.formRequired : ''}`}
                >
                  LINE ID
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="您的 LINE ID"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                />
                {formErrors.lineId && (
                  <div className={styles.formError}>{formErrors.lineId}</div>
                )}
              </div>
            )}

            {formErrors.submit && (
              <div className={styles.formError} style={{ marginBottom: 12 }}>
                {formErrors.submit}
              </div>
            )}

            <button
              type="submit"
              className={styles.formButton}
              style={{ backgroundColor: accentColor }}
              disabled={loading}
            >
              {loading ? '送出中...' : (s?.reserveButtonText || '立即預約')}
            </button>
          </form>
        </div>
      </section>

      {/* ─── Email Verification Modal ────────────────────────── */}
      {showVerify && (
        <div className={styles.verifyOverlay}>
          <div className={styles.verifyModal}>
            <div className={styles.verifyTitle}>驗證您的 Email</div>
            <div className={styles.verifyDesc}>
              我們已發送 6 位數驗證碼至 {verifyEmail}
            </div>

            <input
              type="text"
              className={styles.verifyCodeInput}
              placeholder="000000"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setVerifyCode(val);
              }}
            />

            {formErrors.verify && (
              <div className={styles.formError} style={{ marginBottom: 12 }}>
                {formErrors.verify}
              </div>
            )}

            <div className={styles.verifyActions}>
              <button
                className={styles.verifyButton}
                style={{ backgroundColor: accentColor }}
                onClick={handleVerify}
                disabled={verifyLoading || verifyCode.length !== 6}
              >
                {verifyLoading ? '驗證中...' : '確認驗證'}
              </button>
              <button
                className={styles.verifyResend}
                onClick={handleResend}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? `重新發送 (${resendCooldown}s)`
                  : '重新發送'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
