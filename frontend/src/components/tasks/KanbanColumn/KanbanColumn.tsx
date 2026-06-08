'use client';

import { useState } from 'react';
import TaskCard from '../TaskCard/TaskCard';
import { formatStatus } from '@/lib/utils';
import type { Task } from '@/types';
import styles from './KanbanColumn.module.css';

interface KanbanColumnProps {
  status: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDrop: (e: React.DragEvent) => void;
  onTaskUpdate?: (task: Task) => void;
  patchTimer?: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
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
  onDrop,
  onTaskUpdate,
  patchTimer,
}: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsOver(false);
    onDrop(e);
  };

  return (
    <div
      className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      <div className={styles.header}>
        <div className={styles.dot} style={{ background: statusColors[status] }} />
        <span className={styles.title}>{formatStatus(status)}</span>
        <span className={styles.count}>{tasks.length}</span>
      </div>
      <div className={styles.list}>
        {tasks.length === 0 ? (
          <p className={styles.empty}>Drop a task here</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onClick={() => onTaskClick(task)}
              onDragStart={(e) => onDragStart(e, task)}
              onUpdate={onTaskUpdate}
              patchTimer={patchTimer}
            />
          ))
        )}
      </div>
    </div>
  );
}
