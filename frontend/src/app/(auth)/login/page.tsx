'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button/Button';
import styles from './login.module.css';
import { Eye, EyeOff } from 'lucide-react';

type Phase = 'idle' | 'loading' | 'success' | 'error';

const SUCCESS_DURATION = 2000;
const ERROR_DURATION   = 2200;

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

  useEffect(() => {
    if (phase !== 'success') return;
    const t = setTimeout(() => router.push('/dashboard'), SUCCESS_DURATION);
    return () => clearTimeout(t);
  }, [phase, router]);

  useEffect(() => {
    if (phase !== 'error') return;
    const t = setTimeout(() => setPhase('idle'), ERROR_DURATION);
    return () => clearTimeout(t);
  }, [phase]);

  const isOverlay = phase === 'success' || phase === 'error';

  return (
    <div className={styles.container}>
      <div className={styles.card}>

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

        <div className={styles.logo}>
          <div className={styles.logoIcon}>GS</div>
          <h1 className={styles.logoText}>Ganesyx</h1>
          <p className={styles.logoSub}>Sign in to your account</p>
        </div>

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
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
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
