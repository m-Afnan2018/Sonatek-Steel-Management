'use client';

import { useState } from 'react';
import { useTaskTimer, formatTime } from '@/hooks/useTaskTimer';
import type { Task, ITimerEvent } from '@/types';
import styles from './TaskTimer.module.css';

interface Props {
  task: Task;
  onUpdate: (updated: Task) => void;
  overrideAct?: (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<void>;
}

function getLastResumedAt(events: ITimerEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].action === 'start' || events[i].action === 'resume') {
      return events[i].timestamp;
    }
  }
  return null;
}

export default function TaskTimer({ task, onUpdate, overrideAct }: Props) {
  const [loading, setLoading] = useState(false);

  const isRunning = task.timerStatus === 'running';
  const lastResumedAt = getLastResumedAt(task.timerEvents ?? []);
  const displaySeconds = useTaskTimer(task.totalElapsedSeconds, isRunning, lastResumedAt);

  const act = async (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
    if (loading) return;
    setLoading(true);
    try {
      if (overrideAct) {
        await overrideAct(action);
      } else {
        const res = await fetch(`/api/tasks/${task._id}/timer`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          const updated: Task = await res.json();
          onUpdate(updated);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const showTimer =
    task.timerStatus !== 'idle' &&
    (task.totalElapsedSeconds > 0 || isRunning);

  return (
    <div className={styles.root}>
      {showTimer && (
        <span className={`${styles.display} ${isRunning ? styles.running : styles.stopped}`}>
          {formatTime(displaySeconds)}
        </span>
      )}

      <div className={styles.buttons}>
        {task.timerStatus === 'idle' && (
          <button className={`${styles.btn} ${styles.start}`} onClick={() => act('start')} disabled={loading}>
            ▶ Start
          </button>
        )}

        {task.timerStatus === 'running' && (
          <>
            <button className={`${styles.btn} ${styles.pause}`} onClick={() => act('pause')} disabled={loading}>
              ⏸ Pause
            </button>
            <button className={`${styles.btn} ${styles.hold}`} onClick={() => act('hold')} disabled={loading}>
              On Hold
            </button>
            <button className={`${styles.btn} ${styles.finish}`} onClick={() => act('finish')} disabled={loading}>
              ✓ Done
            </button>
          </>
        )}

        {(task.timerStatus === 'paused' || task.timerStatus === 'on_hold') && (
          <button className={`${styles.btn} ${styles.start}`} onClick={() => act('resume')} disabled={loading}>
            ▶ Resume
          </button>
        )}

        {task.timerStatus === 'finished' && (
          <span className={styles.finished}>Completed</span>
        )}
      </div>
    </div>
  );
}
