'use client';

import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import TaskTimer from '@/components/tasks/TaskTimer';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/types';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onUpdate?: (task: Task) => void;
  patchTimer?: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
}

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

export default function TaskCard({ task, onClick, onDragStart, onUpdate, patchTimer }: TaskCardProps) {
  const handleTimerAct = patchTimer
    ? async (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
        const updated = await patchTimer(task._id, action);
        if (updated && onUpdate) onUpdate(updated);
      }
    : undefined;

  return (
    <div
      className={styles.card}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
    >
      <div className={styles.top}>
        <Badge variant={priorityVariant[task.priority]} size="sm">
          {task.priority}
        </Badge>
        {task.dueDate && (
          <span className={styles.due}>{formatDate(task.dueDate)}</span>
        )}
      </div>

      <h4 className={styles.title}>{task.title}</h4>

      {task.tags.length > 0 && (
        <div className={styles.tags}>
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      {/* Timer — stop propagation so card click doesn't open modal */}
      <div className={styles.timerWrap} onClick={(e) => e.stopPropagation()}>
        <TaskTimer
          task={task}
          onUpdate={onUpdate ?? (() => {})}
          overrideAct={handleTimerAct}
        />
      </div>

      <div className={styles.footer}>
        <div className={styles.avatars}>
          {task.assignees.slice(0, 3).map((a) => (
            <Avatar key={a.id || a.email} name={a.name} size="sm" />
          ))}
        </div>
        {task.estimatedHours && (
          <span className={styles.hours}>
            {Math.floor(task.totalElapsedSeconds / 60)}m / {task.estimatedHours}h
          </span>
        )}
      </div>
    </div>
  );
}
