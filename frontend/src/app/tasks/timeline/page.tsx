'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useTasks } from '@/hooks/useTasks';
import { useAuthStore } from '@/store/authStore';
import type { Task, User } from '@/types';
import styles from './timeline.module.css';

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

interface UserGroup {
  user: User;
  tasks: Task[];
  active: number;
  done: number;
}

export default function TaskTimelinePage() {
  const { allUserTasks, loading, fetchAllUserTasks } = useTasks();
  const currentUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<'all' | 'active' | 'idle'>('all');

  useEffect(() => {
    fetchAllUserTasks();
  }, [fetchAllUserTasks]);

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return <AppShell title="Task Timeline"><div className={styles.denied}>Admin / Manager access only.</div></AppShell>;
  }

  // Group tasks by assignee
  const userMap = new Map<string, UserGroup>();
  allUserTasks.forEach((task) => {
    task.assignees.forEach((assignee) => {
      const key = assignee.id || (assignee as unknown as { _id: string })._id;
      if (!userMap.has(key)) {
        userMap.set(key, { user: assignee, tasks: [], active: 0, done: 0 });
      }
      const group = userMap.get(key)!;
      group.tasks.push(task);
      if (task.status === 'done') group.done++;
      else group.active++;
    });
  });

  let groups = Array.from(userMap.values());
  if (filter === 'active') groups = groups.filter((g) => g.active > 0);
  if (filter === 'idle') groups = groups.filter((g) => g.active === 0);

  return (
    <AppShell title="Task Timeline">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{allUserTasks.filter(t => t.status !== 'done').length}</span>
              <span className={styles.statLabel}>Active Tasks</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{groups.length}</span>
              <span className={styles.statLabel}>Members Tracked</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statNum} ${styles.green}`}>{groups.filter(g => g.active > 0).length}</span>
              <span className={styles.statLabel}>Working Now</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statNum} ${styles.muted}`}>{groups.filter(g => g.active === 0).length}</span>
              <span className={styles.statLabel}>Free / Idle</span>
            </div>
          </div>
          <div className={styles.filterTabs}>
            {(['all', 'active', 'idle'] as const).map((f) => (
              <button key={f} className={`${styles.filterTab} ${filter === f ? styles.active : ''}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : (
          <div className={styles.grid}>
            {groups.map(({ user, tasks, active, done }) => (
              <div key={user.id || (user as unknown as { _id: string })._id} className={styles.userCard}>
                <div className={styles.userHeader}>
                  <div className={styles.userInfo}>
                    <Avatar name={user.name} size="md" />
                    <div>
                      <span className={styles.userName}>{user.name}</span>
                      <span className={styles.userRole}>{user.role}</span>
                    </div>
                  </div>
                  <div className={styles.taskCounts}>
                    <span className={styles.activeCount}>{active} active</span>
                    <span className={styles.doneCount}>{done} done</span>
                  </div>
                </div>
                <div className={styles.taskList}>
                  {tasks.map((task) => (
                    <div key={task._id} className={`${styles.taskItem} ${task.status === 'done' ? styles.taskDone : ''}`}>
                      <div className={styles.taskTop}>
                        <span className={styles.taskTitle}>{task.title}</span>
                        {task.timerStatus === 'running' && task.activeTimerUser === (user.id || (user as unknown as { _id: string })._id) && (
                          <span className={styles.timerBadge}>⏱ Live</span>
                        )}
                      </div>
                      <div className={styles.taskBottom}>
                        <Badge variant={priorityVariant[task.priority]} size="sm">{task.priority}</Badge>
                        <span className={styles.taskStatus}>{task.status.replace('_', ' ')}</span>
                        {task.loggedHours > 0 && <span className={styles.loggedHours}>{task.loggedHours}h logged</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className={styles.empty}>No data found for this filter.</div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
