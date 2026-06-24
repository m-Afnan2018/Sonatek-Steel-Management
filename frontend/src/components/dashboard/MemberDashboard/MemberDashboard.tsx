'use client';

import StatsCard from '../StatsCard/StatsCard';
import ActivityFeed from '../ActivityFeed/ActivityFeed';
import CheckInButton from '@/components/attendance/CheckInButton/CheckInButton';
import QuickTasks from '../QuickTasks/QuickTasks';
import type { Notification, Task } from '@/types';
import styles from './MemberDashboard.module.css';
import { ListTodo, CheckSquare, Clock, Bell } from 'lucide-react';
import { greeting } from '@/lib/utils';

type Status = Task['status'];
type TimerAction = 'start' | 'pause' | 'resume' | 'hold' | 'finish';

interface Props {
  tasks: Task[];
  notifications: Notification[];
  userId: string;
  userName: string;
  role: 'member' | 'viewer';
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onCreate: (title: string) => Promise<void>;
  patchTimer: (id: string, action: TimerAction) => Promise<Task | null>;
  onTimerUpdate: (updated: Task) => void;
}

function resolveId(u: { id?: string; _id?: string }): string {
  return u.id || (u as any)._id || '';
}

export default function MemberDashboard({
  tasks,
  notifications,
  userId,
  userName,
  role,
  onTaskClick,
  onStatusChange,
  onCreate,
  patchTimer,
  onTimerUpdate,
}: Props) {
  const myTasks = tasks.filter((t) =>
    t.assignees.some((a) => resolveId(a as any) === userId)
  );
  const myActive = myTasks.filter((t) => t.status !== 'done').length;
  const myDone = myTasks.filter((t) => t.status === 'done').length;
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <div>
          <h2 className={styles.greetText}>{greeting()}, {userName}</h2>
          <p className={styles.greetSub}>Here's a summary of your work today</p>
        </div>
        <span className={styles.badge} data-role={role}>
          {role === 'viewer' ? 'Viewer' : 'Member'}
        </span>
      </div>

      <div className={styles.stats}>
        <StatsCard title="My Tasks" value={myTasks.length} color="var(--primary)" icon={<ListTodo size={22} />} />
        <StatsCard title="Active" value={myActive} color="var(--warning)" icon={<CheckSquare size={22} />} />
        <StatsCard title="Completed" value={myDone} color="var(--success)" icon={<Clock size={22} />} />
        <StatsCard title="Notifications" value={unread} color="var(--danger)" icon={<Bell size={22} />} />
      </div>

      <div className={styles.grid}>
        <div className={styles.main}>
          <QuickTasks
            tasks={myTasks}
            title="My Tasks"
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            onCreate={onCreate}
            patchTimer={patchTimer}
            onTimerUpdate={onTimerUpdate}
          />
          <ActivityFeed notifications={notifications} />
        </div>
        <div className={styles.sidebar}>
          <CheckInButton />
        </div>
      </div>
    </div>
  );
}
