'use client';

import styles from './ProgressBar.module.css';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percent = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div className={cn(styles.container, className)}>
      <div className={cn(styles.track, styles[size])}>
        <div
          className={cn(styles.fill, styles[variant])}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && <span className={styles.label}>{percent}%</span>}
    </div>
  );
}
