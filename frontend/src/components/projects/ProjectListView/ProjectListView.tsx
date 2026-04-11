'use client';

import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import TaskTimer from '@/components/tasks/TaskTimer';
import { formatDate, formatStatus } from '@/lib/utils';
import type { Task } from '@/types';
import styles from './ProjectListView.module.css';

interface ProjectListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskUpdate?: (task: Task) => void;
  patchTimer?: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
}

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

export default function ProjectListView({ tasks, onTaskClick, onTaskUpdate, patchTimer }: ProjectListViewProps) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignees</th>
            <th>Due Date</th>
            <th>Timer</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const handleTimerAct = patchTimer
              ? async (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
                  const updated = await patchTimer(task._id, action);
                  if (updated && onTaskUpdate) onTaskUpdate(updated);
                }
              : undefined;

            return (
              <tr key={task._id} onClick={() => onTaskClick(task)} className={styles.row}>
                <td className={styles.titleCell}>{task.title}</td>
                <td>
                  <Badge variant="primary">{formatStatus(task.status)}</Badge>
                </td>
                <td>
                  <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
                </td>
                <td>
                  <div className={styles.avatars}>
                    {task.assignees.slice(0, 3).map((a) => (
                      <Avatar key={a.id || a.email} name={a.name} size="sm" />
                    ))}
                  </div>
                </td>
                <td className={styles.date}>
                  {task.dueDate ? formatDate(task.dueDate) : '-'}
                </td>
                <td
                  className={styles.timerCell}
                  onClick={(e) => e.stopPropagation()}
                >
                  <TaskTimer
                    task={task}
                    onUpdate={onTaskUpdate ?? (() => {})}
                    overrideAct={handleTimerAct}
                  />
                </td>
                <td className={styles.hours}>
                  {Math.floor(task.totalElapsedSeconds / 60)}m
                  {task.estimatedHours ? ` / ${task.estimatedHours}h` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <p className={styles.empty}>No tasks found</p>
      )}
    </div>
  );
}
