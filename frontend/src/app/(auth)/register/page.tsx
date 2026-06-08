'use client';

import Link from 'next/link';
import styles from './register.module.css';

export default function RegisterPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>S</div>
          <h1 className={styles.logoText}>Sonatek</h1>
          <p className={styles.logoSub}>Account registration</p>
        </div>

        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Self-registration is disabled. Please contact your administrator to create an account.
          </p>
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 500 }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
