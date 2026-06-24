'use client';

import StatsCard from '../StatsCard/StatsCard';
import ActivityFeed from '../ActivityFeed/ActivityFeed';
import QuickTasks from '../QuickTasks/QuickTasks';
import TeamPerformance from '../TeamPerformance/TeamPerformance';
import AttendanceToday from '../AttendanceToday/AttendanceToday';
import DeptTasksView from '../DeptTasksView/DeptTasksView';
import type { Notification, Task, Attendance, Department } from '@/types';
import type { TeamMember } from '@/types';
import styles from './AdminDashboard.module.css';
import { CheckSquare, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { greeting } from '@/lib/utils';

type Status = Task['status'];
type TimerAction = 'start' | 'pause' | 'resume' | 'hold' | 'finish';

interface Props {
  tasks: Task[];
  members: TeamMember[];
  departments: Department[];
  attendance: Attendance[];
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

export default function AdminDashboard({
  tasks,
  members,
  departments,
  attendance,
  notifications,
  userId,
  userName,
  onTaskClick,
  onStatusChange,
  onCreate,
  patchTimer,
  onTimerUpdate,
}: Props) {
  const activeTasks = tasks.filter((t) =>
    ['todo', 'in_progress', 'in_review'].includes(t.status)
  ).length;

  const checkedIn = attendance.filter((r) =>
    ['present', 'remote', 'late', 'half_day'].includes(r.status)
  ).length;

  const absent = members.length - attendance.length;

  const overdue = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
  ).length;

  // Admin's personally assigned tasks for the quick list
  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const myTasks = tasks
    .filter((t) => t.assignees.some((a) => resolveId(a as any) === userId))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <div>
          <h2 className={styles.greetText}>{greeting()}, {userName}</h2>
          <p className={styles.greetSub}>Here's your organization at a glance</p>
        </div>
        <span className={styles.badge}>Admin</span>
      </div>

      <div className={styles.stats}>
        <StatsCard title="Active Tasks" value={activeTasks} color="var(--warning)" icon={<CheckSquare size={22} />} />
        <StatsCard title="Checked In" value={checkedIn} color="var(--success)" icon={<UserCheck size={22} />} />
        <StatsCard title="Absent Today" value={absent < 0 ? 0 : absent} color="var(--danger)" icon={<UserX size={22} />} />
        <StatsCard title="Overdue Tasks" value={overdue} color="#E8702A" icon={<AlertTriangle size={22} />} />
      </div>

      <div className={styles.grid}>
        <div className={styles.main}>
          <TeamPerformance members={members} tasks={tasks} attendance={attendance} />
          <QuickTasks
            tasks={myTasks}
            title="My Tasks"
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            onCreate={onCreate}
            patchTimer={patchTimer}
            onTimerUpdate={onTimerUpdate}
          />
        </div>
        <div className={styles.sidebar}>
          <AttendanceToday members={members} attendance={attendance} />
          <ActivityFeed notifications={notifications} />
        </div>
      </div>

      <DeptTasksView
        departments={departments}
        tasks={tasks}
        onTaskClick={onTaskClick}
        onStatusChange={onStatusChange}
        patchTimer={patchTimer}
        onTimerUpdate={onTimerUpdate}
      />
    </div>
  );
}
