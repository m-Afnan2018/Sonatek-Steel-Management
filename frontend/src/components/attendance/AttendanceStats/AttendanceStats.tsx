'use client';

import type { AttendanceStats as Stats } from '@/types';
import styles from './AttendanceStats.module.css';

interface AttendanceStatsProps {
  stats: Stats | null;
}

export default function AttendanceStats({ stats }: AttendanceStatsProps) {
  if (!stats) return null;

  const items = [
    { label: 'Present', value: stats.present, color: 'var(--success)' },
    { label: 'Absent', value: stats.absent, color: 'var(--danger)' },
    { label: 'Late', value: stats.late, color: 'var(--warning)' },
    { label: 'Half Day', value: stats.halfDay, color: 'var(--warning)' },
    { label: 'Remote', value: stats.remote, color: 'var(--primary)' },
    { label: 'Leave', value: stats.leave, color: 'var(--danger)' },
  ];

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Monthly Stats</h3>
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.label} className={styles.item}>
            <span className={styles.value} style={{ color: item.color }}>{item.value}</span>
            <span className={styles.label}>{item.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.total}>
        <span>Total Hours</span>
        <strong>{stats.totalHours}h</strong>
        <span className={styles.avgHours}>avg {stats.avgHours}h/day</span>
      </div>
    </div>
  );
}
