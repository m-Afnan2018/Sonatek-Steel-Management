'use client';

import { useEffect, useState } from 'react';
import styles from './SuccessPopup.module.css';

interface SuccessPopupProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onDone?: () => void;
}

export default function SuccessPopup({
  visible,
  title = 'Saved!',
  subtitle = 'Your changes have been saved.',
  onDone,
}: SuccessPopupProps) {
  const [phase, setPhase] = useState<'hidden' | 'enter' | 'exit'>('hidden');

  useEffect(() => {
    if (visible) {
      setPhase('enter');
      const hold = setTimeout(() => setPhase('exit'), 2000);
      const hide = setTimeout(() => { setPhase('hidden'); onDone?.(); }, 2400);
      return () => { clearTimeout(hold); clearTimeout(hide); };
    } else {
      setPhase('hidden');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'hidden') return null;

  return (
    <div className={`${styles.overlay} ${phase === 'exit' ? styles.overlayExit : styles.overlayEnter}`}>
      <div className={`${styles.card} ${phase === 'exit' ? styles.cardExit : styles.cardEnter}`}>

        {/* Animated checkmark */}
        <div className={styles.iconWrap}>
          <svg className={styles.svg} viewBox="0 0 80 80" fill="none">
            {/* Outer glow ring */}
            <circle cx="40" cy="40" r="38" className={styles.glowRing} />
            {/* Main circle */}
            <circle cx="40" cy="40" r="34" className={styles.circleFill} />
            {/* Animated stroke ring */}
            <circle cx="40" cy="40" r="34" className={styles.circleStroke} />
            {/* Check mark */}
            <polyline points="24,41 35,52 56,30" className={styles.check} />
          </svg>
        </div>

        <div className={styles.text}>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {/* Progress bar */}
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} />
        </div>
      </div>
    </div>
  );
}
