'use client';

import TaskCard from '../TaskCard/TaskCard';
import { formatStatus } from '@/lib/utils';
import type { Task } from '@/types';
import styles from './KanbanColumn.module.css';

interface KanbanColumnProps {
  status: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const statusColors: Record<string, string> = {
  backlog: 'var(--text-muted)',
  todo: 'var(--text-secondary)',
  in_progress: 'var(--primary)',
  in_review: 'var(--warning)',
  done: 'var(--success)',
};

export default function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onDragStart,
  onDragOver,
  onDrop,
}: KanbanColumnProps) {
  return (
    <div
      className={styles.column}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={styles.header}>
        <div className={styles.dot} style={{ background: statusColors[status] }} />
        <span className={styles.title}>{formatStatus(status)}</span>
        <span className={styles.count}>{tasks.length}</span>
      </div>
      <div className={styles.list}>
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            onClick={() => onTaskClick(task)}
            onDragStart={(e) => onDragStart(e, task)}
          />
        ))}
      </div>
    </div>
  );
}
