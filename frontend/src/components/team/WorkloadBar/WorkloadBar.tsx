'use client';

import styles from './WorkloadBar.module.css';

interface WorkloadBarProps {
  tasks: number;
  max?: number;
}

export default function WorkloadBar({ tasks, max = 10 }: WorkloadBarProps) {
  const percent = Math.min((tasks / max) * 100, 100);
  const color = percent > 80 ? 'var(--danger)' : percent > 50 ? 'var(--warning)' : 'var(--success)';

  return (
    <div className={styles.track}>
      <div
        className={styles.fill}
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}
