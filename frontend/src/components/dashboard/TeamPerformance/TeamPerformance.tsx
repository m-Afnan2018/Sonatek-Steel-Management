'use client';

import type { TeamMember, Task, Attendance } from '@/types';
import styles from './TeamPerformance.module.css';
import Avatar from '@/components/ui/Avatar/Avatar';
import { isThisWeek, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';

interface Props {
  members: TeamMember[];
  tasks: Task[];
  attendance: Attendance[];
}

function resolveId(u: any): string {
  return u?.id || u?._id || (typeof u === 'string' ? u : '') || '';
}

const ATTENDANCE_COLOR: Record<string, string> = {
  present: 'var(--success)',
  remote: '#4ECDC4',
  late: 'var(--warning)',
  half_day: 'var(--warning)',
  leave: '#7C5CBF',
  absent: 'var(--text-muted)',
};

const ATTENDANCE_LABEL: Record<string, string> = {
  present: 'Present',
  remote: 'Remote',
  late: 'Late',
  half_day: 'Half Day',
  leave: 'On Leave',
  absent: 'Not checked in',
};

export default function TeamPerformance({ members, tasks, attendance }: Props) {
  const router = useRouter();

  const attendanceMap = new Map<string, string>();
  for (const rec of attendance) {
    const uid = resolveId(rec.user);
    if (uid) attendanceMap.set(uid, rec.status);
  }

  const rows = members.map((m) => {
    const completedThisWeek = tasks.filter(
      (t) =>
        t.status === 'done' &&
        t.assignees.some((a) => resolveId(a) === m.id) &&
        isThisWeek(parseISO(t.updatedAt), { weekStartsOn: 1 })
    ).length;

    const isTimerRunning = tasks.some(
      (t) =>
        t.timerStatus === 'running' &&
        t.assignees.some((a) => resolveId(a) === m.id)
    );

    const attendanceStatus = attendanceMap.get(m.id) ?? 'absent';
    const score = completedThisWeek * 3 + m.activeTasks;

    return { ...m, completedThisWeek, isTimerRunning, attendanceStatus, score };
  });

  // Working-now members first, then by score descending
  rows.sort((a, b) => {
    if (a.isTimerRunning !== b.isTimerRunning) return a.isTimerRunning ? -1 : 1;
    return b.score - a.score;
  });

  const maxActive = Math.max(...rows.map((r) => r.activeTasks), 1);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.heading}>Team Performance</h3>
        <button className={styles.viewAll} onClick={() => router.push('/team')}>
          Full view →
        </button>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendName} />
        <span>Active tasks</span>
        <span>Done this week</span>
        <span>Today</span>
      </div>

      <div className={styles.list}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No team members</p>
        ) : (
          rows.map((m) => (
            <div key={m.id} className={styles.row}>
              <div className={styles.avatarWrap}>
                <Avatar name={m.name} src={m.avatar} size="sm" />
                {m.isTimerRunning && (
                  <span className={styles.liveDot} title="Working now" />
                )}
              </div>

              <div className={styles.nameBlock}>
                <span className={styles.name}>{m.name}</span>
                <span className={styles.role}>{m.role}</span>
              </div>

              <div className={styles.barWrap}>
                <div
                  className={styles.bar}
                  style={{ width: `${(m.activeTasks / maxActive) * 100}%` }}
                />
                <span className={styles.barCount}>{m.activeTasks}</span>
              </div>

              <span className={`${styles.weekCount} ${m.completedThisWeek > 0 ? styles.hasCompleted : ''}`}>
                {m.completedThisWeek > 0 ? `+${m.completedThisWeek}` : '—'}
              </span>

              <span
                className={styles.dot}
                style={{ background: ATTENDANCE_COLOR[m.attendanceStatus] }}
                title={ATTENDANCE_LABEL[m.attendanceStatus]}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
