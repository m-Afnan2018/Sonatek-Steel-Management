'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button/Button';
import styles from './login.module.css';

type Phase = 'idle' | 'loading' | 'success' | 'error';

const SUCCESS_DURATION = 2000; // ms to show success before redirecting
const ERROR_DURATION   = 2200; // ms to show error before resetting

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase]           = useState<Phase>('idle');
  const [errorMsg, setErrorMsg]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || phase === 'loading') return;

    setPhase('loading');
    setErrorMsg('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.accessToken);
      setPhase('success');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invalid email or password.';
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  // Auto-redirect after success animation
  useEffect(() => {
    if (phase !== 'success') return;
    const t = setTimeout(() => router.push('/dashboard'), SUCCESS_DURATION);
    return () => clearTimeout(t);
  }, [phase, router]);

  // Auto-reset after error animation
  useEffect(() => {
    if (phase !== 'error') return;
    const t = setTimeout(() => setPhase('idle'), ERROR_DURATION);
    return () => clearTimeout(t);
  }, [phase]);

  const isOverlay = phase === 'success' || phase === 'error';

  return (
    <div className={styles.container}>
      <div className={styles.card}>

        {/* ── Lottie overlay ── */}
        {isOverlay && (
          <div className={`${styles.overlay} ${phase === 'success' ? styles.overlaySuccess : styles.overlayError}`}>
            <DotLottieReact
              src={phase === 'success' ? '/success-lottie.json' : '/error-lottie.json'}
              autoplay
              loop={false}
              style={{ width: 140, height: 140 }}
            />
            <p className={styles.overlayMsg}>
              {phase === 'success' ? 'Welcome back!' : errorMsg}
            </p>
          </div>
        )}

        {/* ── Brand ── */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>GS</div>
          <h1 className={styles.logoText}>Ganesyx</h1>
          <p className={styles.logoSub}>Sign in to your account</p>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={phase === 'loading'}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={phase === 'loading'}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <Button type="submit" loading={phase === 'loading'} fullWidth size="lg">
            Sign In
          </Button>
        </form>

        <p className={styles.footer}>
          Contact your administrator to get an account.
        </p>
      </div>
    </div>
  );
}
