'use client';

import { useEffect, useState } from 'react';
import styles from './SaveToast.module.css';

interface SaveToastProps {
  visible: boolean;
  message?: string;
}

export default function SaveToast({ visible, message = 'Task saved successfully' }: SaveToastProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 400); // wait for exit animation
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div className={`${styles.toast} ${visible ? styles.enter : styles.exit}`}>
      <div className={styles.iconWrap}>
        <svg className={styles.circle} viewBox="0 0 52 52">
          <circle className={styles.circleBg} cx="26" cy="26" r="23" />
          <circle className={styles.circleAnim} cx="26" cy="26" r="23" />
          <polyline className={styles.checkAnim} points="14,26 22,34 38,18" />
        </svg>
      </div>
      <div className={styles.text}>
        <span className={styles.title}>{message}</span>
        <span className={styles.sub}>All changes have been saved</span>
      </div>
    </div>
  );
}
