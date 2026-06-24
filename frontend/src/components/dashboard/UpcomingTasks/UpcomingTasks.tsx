'use client';

import type { Task } from '@/types';
import styles from './UpcomingTasks.module.css';
import { useRouter } from 'next/navigation';
import { isPast, isToday, parseISO, format } from 'date-fns';
import { Clock } from 'lucide-react';
import { getPriorityColor, formatStatus } from '@/lib/utils';

interface Props {
  tasks: Task[];
}

export default function UpcomingTasks({ tasks }: Props) {
  const router = useRouter();

  const sorted = [...tasks]
    .filter((t) => t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>
        <Clock size={16} />
        Upcoming Deadlines
      </h3>
      <div className={styles.list}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>No upcoming deadlines</p>
        ) : (
          sorted.slice(0, 6).map((t) => {
            const due = parseISO(t.dueDate!);
            const overdue = isPast(due) && !isToday(due);
            const today = isToday(due);
            return (
              <div
                key={t._id}
                className={styles.item}
                onClick={() => router.push('/tasks')}
              >
                <div className={styles.left}>
                  <span
                    className={styles.priorityDot}
                    style={{ background: getPriorityColor(t.priority) }}
                  />
                  <div>
                    <p className={styles.title}>{t.title}</p>
                    <span className={styles.status}>{formatStatus(t.status)}</span>
                  </div>
                </div>
                <span
                  className={`${styles.due} ${overdue ? styles.overdue : today ? styles.today : ''}`}
                >
                  {overdue ? 'Overdue' : today ? 'Today' : format(due, 'MMM d')}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
