'use client';

import Avatar from '@/components/ui/Avatar/Avatar';
import Badge from '@/components/ui/Badge/Badge';
import { formatTime, formatStatus } from '@/lib/utils';
import type { Attendance, User } from '@/types';
import styles from './TeamAttendanceTable.module.css';

interface TeamAttendanceTableProps {
  records: Attendance[];
}

const statusVariant: Record<string, 'success' | 'danger' | 'warning' | 'primary' | 'default'> = {
  present: 'success',
  absent: 'danger',
  half_day: 'warning',
  remote: 'primary',
  leave: 'danger',
};

/** Returns hours worked as a display string.
 *  - If checked out: use stored hoursWorked.
 *  - If still checked in: (now − checkIn) − lunch taken so far. */
function liveHours(r: Attendance): string {
  if (!r.checkIn) return '-';

  // Already checked out — use the stored value
  if (r.checkOut) return `${r.hoursWorked.toFixed(1)}h`;

  const now = Date.now();
  const elapsedMs = now - new Date(r.checkIn).getTime();

  // Lunch already finished
  let lunchMs = (r.lunchDuration ?? 0) * 60 * 1000;

  // Currently on lunch (lunchStart set, lunchStop not yet)
  if (r.lunchStart && !r.lunchStop) {
    lunchMs = now - new Date(r.lunchStart).getTime();
  }

  const hours = Math.max(0, (elapsedMs - lunchMs) / (1000 * 60 * 60));
  return `${hours.toFixed(1)}h`;
}

export default function TeamAttendanceTable({ records }: TeamAttendanceTableProps) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Member</th>
            <th>Status</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Lunch Start</th>
            <th>Lunch End</th>
            <th>Lunch</th>
            <th>Hours</th>
            <th>Work Mode</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const user = r.user as User;
            return (
              <tr key={r._id}>
                <td>
                  <div className={styles.member}>
                    <Avatar name={user?.name || 'U'} size="sm" />
                    <div>
                      <span className={styles.name}>{user?.name}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge variant={statusVariant[r.status] || 'default'}>
                    {formatStatus(r.status)}
                  </Badge>
                </td>
                <td className={styles.time}>
                  {r.checkIn ? formatTime(r.checkIn) : '-'}
                </td>
                <td className={styles.time}>
                  {r.checkOut ? formatTime(r.checkOut) : '-'}
                </td>
                <td className={styles.time}>
                  {r.lunchStart ? formatTime(r.lunchStart) : '-'}
                </td>
                <td className={styles.time}>
                  {r.lunchStop ? formatTime(r.lunchStop) : '-'}
                </td>
                <td className={styles.lunch}>
                  {r.lunchDuration != null && r.lunchDuration > 0 ? `${r.lunchDuration}m` : '-'}
                </td>
                <td className={styles.hours}>
                  {liveHours(r)}
                  {r.checkIn && !r.checkOut && (
                    <span className={styles.liveIndicator} title="Currently checked in" />
                  )}
                </td>
                <td>
                  <span className={styles.mode}>{r.workMode}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {records.length === 0 && (
        <p className={styles.empty}>No attendance records for this date</p>
      )}

      <div className={styles.exportPlaceholder}>
        <button className={styles.exportBtn} disabled>
          Export CSV (Coming Soon)
        </button>
      </div>
    </div>
  );
}
