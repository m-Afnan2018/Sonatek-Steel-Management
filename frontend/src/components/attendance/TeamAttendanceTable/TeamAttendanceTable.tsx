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
                      <span className={styles.dept}>{user?.department}</span>
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
                <td className={styles.hours}>{r.hoursWorked}h</td>
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
