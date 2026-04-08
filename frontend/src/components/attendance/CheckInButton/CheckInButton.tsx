'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button/Button';
import { useAttendance } from '@/hooks/useAttendance';
import { formatTime } from '@/lib/utils';
import styles from './CheckInButton.module.css';

type FlowState = 'idle' | 'checked_in' | 'on_lunch' | 'checked_out';

export default function CheckInButton() {
  const { checkIn, checkOut, lunchStart, lunchStop, loading, error } = useAttendance();
  const [flow, setFlow] = useState<FlowState>('idle');
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [lunchStartTime, setLunchStartTime] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<'office' | 'remote' | 'hybrid'>('office');
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { default: api } = await import('@/lib/api');
        const { data } = await api.get('/attendance/my', {
          params: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
        });
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = data.find((r: { date: string }) => r.date.startsWith(today));
        if (todayRecord?.checkOut) {
          setFlow('checked_out');
          setCheckInTime(todayRecord.checkIn);
        } else if (todayRecord?.lunchStart && !todayRecord?.lunchStop) {
          setFlow('on_lunch');
          setCheckInTime(todayRecord.checkIn);
          setLunchStartTime(todayRecord.lunchStart);
        } else if (todayRecord?.checkIn) {
          setFlow('checked_in');
          setCheckInTime(todayRecord.checkIn);
          setIsLate(todayRecord.isLate);
        }
      } catch {
        // ignore
      }
    };
    checkStatus();
  }, []);

  const handleCheckIn = async () => {
    const result = await checkIn(workMode);
    if (result) {
      setFlow('checked_in');
      setCheckInTime(result.checkIn);
      setIsLate(result.isLate);
    }
  };

  const handleLunchStart = async () => {
    const result = await lunchStart();
    if (result) {
      setFlow('on_lunch');
      setLunchStartTime(result.lunchStart);
    }
  };

  const handleLunchStop = async () => {
    const result = await lunchStop();
    if (result) {
      setFlow('checked_in');
      setLunchStartTime(null);
    }
  };

  const handleCheckOut = async () => {
    const result = await checkOut();
    if (result) {
      setFlow('checked_out');
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Today&apos;s Attendance</h3>

      {flow === 'idle' && (
        <>
          <div className={styles.modeSelect}>
            <label className={styles.modeLabel}>Work Mode:</label>
            <div className={styles.modes}>
              {(['office', 'remote', 'hybrid'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`${styles.modeBtn} ${workMode === mode ? styles.modeActive : ''}`}
                  onClick={() => setWorkMode(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleCheckIn} loading={loading} fullWidth size="lg">
            Check In
          </Button>
        </>
      )}

      {flow === 'checked_in' && (
        <div className={styles.activeSection}>
          <div className={styles.status}>
            <div className={styles.statusIcon} />
            <div>
              <p className={styles.statusText}>
                Checked in {isLate && <span className={styles.lateBadge}>Late</span>}
              </p>
              {checkInTime && <p className={styles.statusTime}>at {formatTime(checkInTime)}</p>}
            </div>
          </div>
          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={handleLunchStart} loading={loading} size="sm">
              🍽 Lunch Start
            </Button>
            <Button variant="danger" onClick={handleCheckOut} loading={loading} size="sm">
              Check Out
            </Button>
          </div>
        </div>
      )}

      {flow === 'on_lunch' && (
        <div className={styles.activeSection}>
          <div className={styles.status}>
            <div className={`${styles.statusIcon} ${styles.lunch}`} />
            <div>
              <p className={styles.statusText}>On Lunch Break</p>
              {lunchStartTime && <p className={styles.statusTime}>since {formatTime(lunchStartTime)}</p>}
            </div>
          </div>
          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={handleLunchStop} loading={loading} size="sm">
              🍽 Lunch Stop
            </Button>
            <Button variant="danger" onClick={handleCheckOut} loading={loading} size="sm">
              Check Out
            </Button>
          </div>
        </div>
      )}

      {flow === 'checked_out' && (
        <div className={styles.status}>
          <div className={`${styles.statusIcon} ${styles.done}`} />
          <div>
            <p className={styles.statusText}>Completed for today</p>
            {checkInTime && <p className={styles.statusTime}>Checked in at {formatTime(checkInTime)}</p>}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
