'use client';

import StatsCard from '../StatsCard/StatsCard';
import TeamWorkload from '../TeamWorkload/TeamWorkload';
import ActivityFeed from '../ActivityFeed/ActivityFeed';
import CheckInButton from '@/components/attendance/CheckInButton/CheckInButton';
import QuickTasks from '../QuickTasks/QuickTasks';
import type { Notification, Task, Department } from '@/types';
import type { TeamMember } from '@/types';
import styles from './ManagerDashboard.module.css';
import { ListTodo, CheckSquare, Users, Bell } from 'lucide-react';
import { greeting } from '@/lib/utils';

type Status = Task['status'];
type TimerAction = 'start' | 'pause' | 'resume' | 'hold' | 'finish';

interface Props {
  tasks: Task[];
  members: TeamMember[];
  departments: Department[];
  notifications: Notification[];
  userId: string;
  userName: string;
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onCreate: (title: string) => Promise<void>;
  patchTimer: (id: string, action: TimerAction) => Promise<Task | null>;
  onTimerUpdate: (updated: Task) => void;
}

function resolveId(u: { id?: string; _id?: string }): string {
  return u.id || (u as any)._id || '';
}

export default function ManagerDashboard({
  tasks,
  members,
  departments,
  notifications,
  userId,
  userName,
  onTaskClick,
  onStatusChange,
  onCreate,
  patchTimer,
  onTimerUpdate,
}: Props) {
  const myDepts = departments.filter((d) =>
    d.heads.some((h) => resolveId(h as any) === userId)
  );

  const deptMemberIds = new Set(
    myDepts.flatMap((d) => [
      ...d.members.map((m) => resolveId(m as any)),
      ...d.heads.map((m) => resolveId(m as any)),
    ])
  );

  const deptMembers = members.filter((m) => deptMemberIds.has(m.id));
  const deptTasks = tasks.filter((t) =>
    t.assignees.some((a) => deptMemberIds.has(resolveId(a as any)))
  );
  const activeDeptTasks = deptTasks.filter((t) =>
    ['todo', 'in_progress', 'in_review'].includes(t.status)
  ).length;
  const unread = notifications.filter((n) => !n.isRead).length;
  const deptLabel = myDepts.map((d) => d.name).join(', ') || 'Your Department';

  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  // Manager's own assigned tasks
  const myTasks = tasks
    .filter((t) => t.assignees.some((a) => resolveId(a as any) === userId))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  // Team tasks: dept tasks NOT assigned to the manager themselves
  const teamTasks = deptTasks
    .filter((t) => !t.assignees.some((a) => resolveId(a as any) === userId))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <div>
          <h2 className={styles.greetText}>{greeting()}, {userName}</h2>
          <p className={styles.greetSub}>{deptLabel}</p>
        </div>
        <span className={styles.badge}>Manager</span>
      </div>

      <div className={styles.stats}>
        <StatsCard title="Dept Members" value={deptMembers.length} color="var(--primary)" icon={<Users size={22} />} />
        <StatsCard title="Dept Tasks" value={deptTasks.length} color="#7C5CBF" icon={<ListTodo size={22} />} />
        <StatsCard title="Active Tasks" value={activeDeptTasks} color="var(--warning)" icon={<CheckSquare size={22} />} />
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
          <QuickTasks
            tasks={teamTasks}
            title="Team Tasks"
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
          <TeamWorkload members={deptMembers.length > 0 ? deptMembers : members} />
        </div>
      </div>
    </div>
  );
}
