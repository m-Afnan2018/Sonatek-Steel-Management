'use client';

import { useEffect, useRef, useState } from 'react';

export function useTaskTimer(
  totalElapsedSeconds: number,
  isRunning: boolean,
  lastResumedAt: string | null,
): number {
  const [display, setDisplay] = useState(totalElapsedSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (isRunning && lastResumedAt) {
      const base = totalElapsedSeconds;
      const resumeTime = new Date(lastResumedAt).getTime();

      const tick = () => {
        const ongoingSeconds = (Date.now() - resumeTime) / 1000;
        setDisplay(Math.floor(base + ongoingSeconds));
      };

      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setDisplay(totalElapsedSeconds);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, totalElapsedSeconds, lastResumedAt]);

  return display;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
