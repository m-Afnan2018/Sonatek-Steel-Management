'use client';

import { ReactNode } from 'react';
import styles from './StatsCard.module.css';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  trend?: { value: number; label: string };
}

export default function StatsCard({ title, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.iconWrap} style={{ background: `${color}15`, color }}>
        {icon}
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{title}</span>
        <span className={styles.value}>{value}</span>
        {trend && (
          <span
            className={styles.trend}
            style={{ color: trend.value >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
