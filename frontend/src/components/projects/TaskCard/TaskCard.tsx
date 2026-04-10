'use client';

import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import { formatDate } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import { useAuthStore } from '@/store/authStore';
import type { Task } from '@/types';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onUpdate?: (task: Task) => void;
}

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

export default function TaskCard({ task, onClick, onDragStart, onUpdate }: TaskCardProps) {
  const { patchTimer } = useTasks();
  const user = useAuthStore((s) => s.user);
  void user;

  const handleTimer = async (e: React.MouseEvent, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
    e.stopPropagation();
    const result = await patchTimer(task._id, action);
    if (result && onUpdate) onUpdate(result);
  };

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

      {/* Timer controls */}
      {task.timerStatus !== 'finished' && (
        <div className={styles.timer} onClick={(e) => e.stopPropagation()}>
          {task.timerStatus === 'idle' && (
            <button className={styles.timerBtn} onClick={(e) => handleTimer(e, 'start')}>▶ Start</button>
          )}
          {task.timerStatus === 'running' && (
            <>
              <span className={styles.timerRunning}>⏱ Running</span>
              <button className={styles.timerBtn} onClick={(e) => handleTimer(e, 'pause')}>Pause</button>
              <button className={`${styles.timerBtn} ${styles.timerDone}`} onClick={(e) => handleTimer(e, 'finish')}>Done</button>
            </>
          )}
          {(task.timerStatus === 'paused' || task.timerStatus === 'on_hold') && (
            <>
              <span className={styles.timerPaused}>⏸ Paused</span>
              <button className={styles.timerBtn} onClick={(e) => handleTimer(e, 'resume')}>Resume</button>
              <button className={`${styles.timerBtn} ${styles.timerDone}`} onClick={(e) => handleTimer(e, 'finish')}>Done</button>
            </>
          )}
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.avatars}>
          {task.assignees.slice(0, 2).map((a) => (
            <Avatar key={a.id || a.email} name={a.name} size="sm" />
          ))}
        </div>
        {task.estimatedHours && (
          <span className={styles.hours}>
            {Math.floor(task.totalElapsedSeconds / 60)}m/{task.estimatedHours}h
          </span>
        )}
      </div>
    </div>
  );
}
