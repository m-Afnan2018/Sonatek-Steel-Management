'use client';

import Avatar from '@/components/ui/Avatar/Avatar';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import type { TeamMember } from '@/types';
import styles from './TeamWorkload.module.css';
import { useRouter } from 'next/navigation';

interface TeamWorkloadProps {
  members: TeamMember[];
}

export default function TeamWorkload({ members }: TeamWorkloadProps) {
  const sorted = [...members].sort((a, b) => b.activeTasks - a.activeTasks);
  const maxTasks = Math.max(...members.map((m) => m.activeTasks), 1);
  const router = useRouter()

  return (
    <div className={styles.card} onClick={() => router.push('/team')}>
      <h3 className={styles.heading}>Team Workload</h3>
      <div className={styles.list}>
        {sorted.slice(0, 6).map((m) => (
          <div key={m.id} className={styles.item}>
            <Avatar name={m.name} src={m.avatar} size="sm" />
            <div className={styles.info}>
              <div className={styles.top}>
                <span className={styles.name}>{m.name}</span>
                <span className={styles.count}>{m.activeTasks} tasks</span>
              </div>
              <ProgressBar
                value={m.activeTasks}
                max={maxTasks}
                size="sm"
                variant={
                  m.activeTasks > maxTasks * 0.8
                    ? 'danger'
                    : m.activeTasks > maxTasks * 0.5
                      ? 'warning'
                      : 'primary'
                }
              />
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <p className={styles.empty}>No team members</p>
        )}
      </div>
    </div>
  );
}
