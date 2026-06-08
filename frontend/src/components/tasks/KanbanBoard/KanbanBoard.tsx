'use client';

import { useState } from 'react';
import KanbanColumn from '../KanbanColumn/KanbanColumn';
import type { Task } from '@/types';
import styles from './KanbanBoard.module.css';

const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (task: Task, status: string) => void;
  onTaskUpdate?: (task: Task) => void;
  patchTimer?: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
}

export default function KanbanBoard({
  tasks,
  onTaskClick,
  onStatusChange,
  onTaskUpdate,
  patchTimer,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDrop = (status: string) => () => {
    if (draggedTask && draggedTask.status !== status) {
      onStatusChange(draggedTask, status);
    }
    setDraggedTask(null);
  };

  const groupedTasks = STATUSES.reduce<Record<string, Task[]>>((acc, status) => {
    acc[status] = tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className={styles.board}>
      {STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={groupedTasks[status] || []}
          onTaskClick={onTaskClick}
          onDragStart={handleDragStart}
          onDrop={handleDrop(status)}
          onTaskUpdate={onTaskUpdate}
          patchTimer={patchTimer}
        />
      ))}
    </div>
  );
}
