'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button/Button';
import { useAttendance } from '@/hooks/useAttendance';
import { formatTime } from '@/lib/utils';
import styles from './CheckInButton.module.css';
import { AlertCircle } from 'lucide-react';

type FlowState = 'idle' | 'checked_in' | 'on_lunch' | 'checked_out';

interface CheckInButtonProps {
  viewUserId?: string;
  viewUserName?: string;
}

export default function CheckInButton({ viewUserId, viewUserName }: CheckInButtonProps = {}) {
  const { checkIn, checkOut, lunchStart, lunchStop, loading, error } = useAttendance();
  const [flow, setFlow] = useState<FlowState>('idle');
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [lunchStartTime, setLunchStartTime] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<'office' | 'remote' | 'hybrid'>('office');
  const [isLate, setIsLate] = useState(false);
  const [lunchElapsedMins, setLunchElapsedMins] = useState(0);

  // Fetch own status
  useEffect(() => {
    if (viewUserId) return; // skip when viewing another user
    const checkStatus = async () => {
      try {
        const { default: api } = await import('@/lib/api');
        const { data } = await api.get('/attendance/my', {
          params: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
        });
        const toIST = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
        const today = toIST(new Date());
        const todayRecord = data.find((r: { date: string }) => toIST(new Date(r.date)) === today);
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
  }, [viewUserId]);

  // Fetch selected user's today status (admin view)
  const [viewedRecord, setViewedRecord] = useState<null | {
    checkIn?: string; checkOut?: string; lunchStart?: string; lunchStop?: string;
    status?: string; isLate?: boolean; hoursWorked?: number; workMode?: string;
  }>(null);

  useEffect(() => {
    if (!viewUserId) { setViewedRecord(null); return; }
    const fetch = async () => {
      try {
        const { default: api } = await import('@/lib/api');
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const { data } = await api.get('/attendance/team', { params: { date: today, userId: viewUserId } });
        setViewedRecord(data[0] ?? null);
      } catch {
        setViewedRecord(null);
      }
    };
    fetch();
  }, [viewUserId]);

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
      setLunchElapsedMins(0);
    }
  };

  // Live lunch timer — updates every minute while on lunch
  useEffect(() => {
    if (flow !== 'on_lunch' || !lunchStartTime) return;

    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(lunchStartTime).getTime()) / 60_000);
      setLunchElapsedMins(mins);
    };

    tick(); // run immediately
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [flow, lunchStartTime]);

  const handleCheckOut = async () => {
    const result = await checkOut();
    if (result) {
      setFlow('checked_out');
    }
  };

  // Read-only view when admin is viewing another user
  if (viewUserId) {
    const statusLabel: Record<string, string> = {
      present: 'Present', remote: 'Remote', late: 'Late',
      half_day: 'Half Day', absent: 'Absent', leave: 'On Leave',
    };
    const statusColor: Record<string, string> = {
      present: 'var(--success)', remote: 'var(--primary)', late: 'var(--warning)',
      half_day: 'var(--warning)', absent: 'var(--danger)', leave: 'var(--danger)',
    };
    return (
      <div className={styles.card}>
        <h3 className={styles.heading}>Today — {viewUserName || 'User'}</h3>
        {!viewedRecord ? (
          <p className={styles.noRecord}>No attendance record for today.</p>
        ) : (
          <div className={styles.viewedRecord}>
            {viewedRecord.status && (
              <div className={styles.status}>
                <div className={styles.statusIcon} style={{ background: statusColor[viewedRecord.status] ?? 'var(--text-muted)' }} />
                <div>
                  <p className={styles.statusText} style={{ color: statusColor[viewedRecord.status] }}>
                    {statusLabel[viewedRecord.status] ?? viewedRecord.status}
                    {viewedRecord.isLate && <span className={styles.lateBadge}>Late</span>}
                  </p>
                  {viewedRecord.workMode && (
                    <p className={styles.statusTime}>{viewedRecord.workMode}</p>
                  )}
                </div>
              </div>
            )}
            <div className={styles.viewedTimes}>
              {viewedRecord.checkIn && (
                <div className={styles.viewedRow}>
                  <span className={styles.viewedTimeLabel}>Check In</span>
                  <span>{formatTime(viewedRecord.checkIn)}</span>
                </div>
              )}
              {viewedRecord.lunchStart && (
                <div className={styles.viewedRow}>
                  <span className={styles.viewedTimeLabel}>Lunch</span>
                  <span>
                    {formatTime(viewedRecord.lunchStart)}
                    {viewedRecord.lunchStop ? ` – ${formatTime(viewedRecord.lunchStop)}` : ' (ongoing)'}
                  </span>
                </div>
              )}
              {viewedRecord.checkOut && (
                <div className={styles.viewedRow}>
                  <span className={styles.viewedTimeLabel}>Check Out</span>
                  <span>{formatTime(viewedRecord.checkOut)}</span>
                </div>
              )}
              {viewedRecord.hoursWorked != null && viewedRecord.hoursWorked > 0 && (
                <div className={styles.viewedRow}>
                  <span className={styles.viewedTimeLabel}>Hours</span>
                  <span>{viewedRecord.hoursWorked}h</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

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
              {lunchStartTime && (
                <p className={styles.statusTime}>
                  since {formatTime(lunchStartTime)}
                  {lunchElapsedMins > 0 && ` · ${lunchElapsedMins}m elapsed`}
                </p>
              )}
            </div>
          </div>

          {lunchElapsedMins >= 60 && (
            <div className={styles.overtimeBanner}>
              <AlertCircle size={14} />
              <span>Lunch over {lunchElapsedMins - 60}m ago — did you forget to stop?</span>
            </div>
          )}

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
