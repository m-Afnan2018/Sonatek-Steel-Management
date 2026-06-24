'use client';

import type { TeamMember, Attendance } from '@/types';
import styles from './AttendanceToday.module.css';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useRouter } from 'next/navigation';
import { UserCheck, UserX, Clock } from 'lucide-react';

interface Props {
  members: TeamMember[];
  attendance: Attendance[];
}

function resolveId(u: any): string {
  return u?.id || u?._id || (typeof u === 'string' ? u : '') || '';
}

const STATUS_COLOR: Record<string, string> = {
  present: 'var(--success)',
  remote: '#4ECDC4',
  late: 'var(--warning)',
  half_day: 'var(--warning)',
  leave: '#7C5CBF',
  absent: 'var(--danger)',
};

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  remote: 'Remote',
  late: 'Late',
  half_day: 'Half Day',
  leave: 'On Leave',
  absent: 'Not in yet',
};

export default function AttendanceToday({ members, attendance }: Props) {
  const router = useRouter();

  const attendanceMap = new Map<string, Attendance>();
  for (const rec of attendance) {
    attendanceMap.set(resolveId(rec.user), rec);
  }

  const checkedIn = attendance.filter((r) =>
    ['present', 'remote', 'late', 'half_day'].includes(r.status)
  ).length;
  const onLeave = attendance.filter((r) => r.status === 'leave').length;
  const absent = members.length - attendance.length;

  const rows = members.map((m) => {
    const rec = attendanceMap.get(m.id);
    return { member: m, status: rec?.status ?? 'absent', checkIn: rec?.checkIn };
  });

  const ORDER: Record<string, number> = { present: 0, remote: 1, late: 2, half_day: 3, leave: 4, absent: 5 };
  rows.sort((a, b) => (ORDER[a.status] ?? 6) - (ORDER[b.status] ?? 6));

  return (
    <div className={styles.card} onClick={() => router.push('/attendance/team')}>
      <div className={styles.header}>
        <h3 className={styles.heading}>Today's Attendance</h3>
        <span className={styles.date}>
          {new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem} style={{ color: 'var(--success)' }}>
          <UserCheck size={13} />
          <span>{checkedIn} in</span>
        </div>
        {onLeave > 0 && (
          <div className={styles.summaryItem} style={{ color: '#7C5CBF' }}>
            <span>{onLeave} leave</span>
          </div>
        )}
        <div className={styles.summaryItem} style={{ color: 'var(--danger)' }}>
          <UserX size={13} />
          <span>{absent} absent</span>
        </div>
      </div>

      <div className={styles.list}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No records for today yet</p>
        ) : (
          rows.map(({ member, status, checkIn }) => (
            <div key={member.id} className={styles.row}>
              <Avatar name={member.name} src={member.avatar} size="sm" />
              <span className={styles.name}>{member.name}</span>
              {checkIn ? (
                <span className={styles.time}>
                  <Clock size={10} />
                  {new Date(checkIn).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              ) : (
                <span />
              )}
              <span
                className={styles.statusDot}
                style={{ background: STATUS_COLOR[status] }}
                title={STATUS_LABEL[status]}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
