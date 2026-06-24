'use client';

import { useState } from 'react';
import type { Task } from '@/types';
import styles from './QuickTasks.module.css';
import { Circle, CheckCircle2, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { getPriorityColor } from '@/lib/utils';
import MiniTimer from '../MiniTimer/MiniTimer';

type Status = Task['status'];

const NEXT_STATUS: Record<Status, Status> = {
  backlog: 'todo',
  todo: 'in_progress',
  in_progress: 'in_review',
  in_review: 'done',
  done: 'done',
};

const STATUS_LABEL: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

const STATUS_COLOR: Record<Status, string> = {
  backlog: 'var(--text-muted)',
  todo: 'var(--primary)',
  in_progress: 'var(--warning)',
  in_review: '#7C5CBF',
  done: 'var(--success)',
};

type TimerAction = 'start' | 'pause' | 'resume' | 'hold' | 'finish';

interface Props {
  tasks: Task[];
  title?: string;
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  onCreate: (title: string) => Promise<void>;
  patchTimer: (id: string, action: TimerAction) => Promise<Task | null>;
  onTimerUpdate: (updated: Task) => void;
}

export default function QuickTasks({
  tasks,
  title = 'My Tasks',
  onTaskClick,
  onStatusChange,
  onCreate,
  patchTimer,
  onTimerUpdate,
}: Props) {
  const [inputVal, setInputVal] = useState('');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const activeTasks = tasks.filter((t) => t.status !== 'done').slice(0, 8);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputVal.trim();
    if (!val) return;
    setCreating(true);
    try {
      await onCreate(val);
      setInputVal('');
    } finally {
      setCreating(false);
    }
  };

  const handleAdvance = async (task: Task) => {
    const next = NEXT_STATUS[task.status];
    if (next === task.status) return;
    setUpdating(task._id);
    try {
      await onStatusChange(task._id, next);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.heading}>{title}</h3>
        {activeTasks.length > 0 && (
          <span className={styles.count}>{activeTasks.length} active</span>
        )}
      </div>

      {/* Inline quick-create */}
      <form className={styles.createRow} onSubmit={handleCreate}>
        <Plus size={14} className={styles.plusIcon} />
        <input
          className={styles.createInput}
          placeholder="Add a task…"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          disabled={creating}
        />
        {inputVal.trim() && (
          <button type="submit" className={styles.addBtn} disabled={creating}>
            {creating ? <Loader2 size={13} className={styles.spin} /> : 'Add'}
          </button>
        )}
      </form>

      <div className={styles.list}>
        {activeTasks.length === 0 ? (
          <p className={styles.empty}>All caught up! No active tasks.</p>
        ) : (
          activeTasks.map((task) => {
            const isUpdating = updating === task._id;
            const nextLabel = STATUS_LABEL[NEXT_STATUS[task.status]];
            return (
              <div key={task._id} className={styles.item}>
                {/* One-click status advance */}
                <button
                  className={styles.circle}
                  style={{ color: STATUS_COLOR[task.status] } as React.CSSProperties}
                  onClick={() => handleAdvance(task)}
                  disabled={isUpdating || task.status === 'done'}
                  title={task.status !== 'done' ? `Move to ${nextLabel}` : 'Done'}
                >
                  {isUpdating ? (
                    <Loader2 size={17} className={styles.spin} />
                  ) : task.status === 'done' ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <Circle size={17} />
                  )}
                </button>

                {/* Title + meta — click to open modal */}
                <div className={styles.info} onClick={() => onTaskClick(task)}>
                  <p className={styles.taskTitle}>{task.title}</p>
                  <div className={styles.meta}>
                    <span
                      className={styles.statusBadge}
                      style={{ color: STATUS_COLOR[task.status] }}
                    >
                      {STATUS_LABEL[task.status]}
                    </span>
                    <span
                      className={styles.priorityBadge}
                      style={{ color: getPriorityColor(task.priority) }}
                    >
                      {task.priority}
                    </span>
                    {task.dueDate && (
                      <span className={styles.due}>
                        {new Date(task.dueDate).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <MiniTimer
                  task={task}
                  onUpdate={onTimerUpdate}
                  patchTimer={patchTimer}
                />

                <ChevronRight
                  size={15}
                  className={styles.arrow}
                  onClick={() => onTaskClick(task)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
