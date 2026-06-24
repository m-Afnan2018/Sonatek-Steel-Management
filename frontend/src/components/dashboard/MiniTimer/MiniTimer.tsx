'use client';

import { useState } from 'react';
import { Play, Pause, Square, Loader2 } from 'lucide-react';
import { useTaskTimer, formatTime } from '@/hooks/useTaskTimer';
import type { Task, ITimerEvent } from '@/types';
import styles from './MiniTimer.module.css';

type TimerAction = 'start' | 'pause' | 'resume' | 'hold' | 'finish';

interface Props {
  task: Task;
  onUpdate: (updated: Task) => void;
  patchTimer: (id: string, action: TimerAction) => Promise<Task | null>;
}

function getLastResumedAt(events: ITimerEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const a = events[i].action;
    if (a === 'start' || a === 'resume') return events[i].timestamp;
  }
  return null;
}

export default function MiniTimer({ task, onUpdate, patchTimer }: Props) {
  const [loading, setLoading] = useState(false);

  const isRunning = task.timerStatus === 'running';
  const lastResumedAt = getLastResumedAt(task.timerEvents ?? []);
  const elapsed = useTaskTimer(task.totalElapsedSeconds ?? 0, isRunning, lastResumedAt);

  const showElapsed =
    task.timerStatus !== 'idle' || (task.totalElapsedSeconds ?? 0) > 0;

  const act = async (action: TimerAction) => {
    if (loading) return;
    setLoading(true);
    try {
      const updated = await patchTimer(task._id, action);
      if (updated) onUpdate(updated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root} onClick={(e) => e.stopPropagation()}>
      {showElapsed && (
        <span className={`${styles.time} ${isRunning ? styles.ticking : ''}`}>
          {formatTime(elapsed)}
        </span>
      )}

      <div className={styles.controls}>
        {loading ? (
          <Loader2 size={13} className={styles.spin} />
        ) : task.timerStatus === 'idle' ? (
          <button
            className={`${styles.btn} ${styles.play}`}
            onClick={() => act('start')}
            title="Start timer"
          >
            <Play size={12} fill="currentColor" />
          </button>
        ) : task.timerStatus === 'running' ? (
          <>
            <button
              className={`${styles.btn} ${styles.pause}`}
              onClick={() => act('pause')}
              title="Pause"
            >
              <Pause size={12} fill="currentColor" />
            </button>
            <button
              className={`${styles.btn} ${styles.stop}`}
              onClick={() => act('finish')}
              title="Finish"
            >
              <Square size={12} fill="currentColor" />
            </button>
          </>
        ) : task.timerStatus === 'paused' || task.timerStatus === 'on_hold' ? (
          <>
            <button
              className={`${styles.btn} ${styles.play}`}
              onClick={() => act('resume')}
              title="Resume"
            >
              <Play size={12} fill="currentColor" />
            </button>
            <button
              className={`${styles.btn} ${styles.stop}`}
              onClick={() => act('finish')}
              title="Finish"
            >
              <Square size={12} fill="currentColor" />
            </button>
          </>
        ) : task.timerStatus === 'finished' ? (
          <span className={styles.done} title={`Total: ${formatTime(elapsed)}`}>✓</span>
        ) : null}
      </div>
    </div>
  );
}
