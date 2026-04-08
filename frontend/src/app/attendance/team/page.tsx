'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import TeamAttendanceTable from '@/components/attendance/TeamAttendanceTable/TeamAttendanceTable';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useAttendance } from '@/hooks/useAttendance';
import styles from './teamAttendance.module.css';

export default function TeamAttendancePage() {
  const { teamRecords, loading, error, fetchTeamAttendance } = useAttendance();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchTeamAttendance(selectedDate);
  }, [selectedDate, fetchTeamAttendance]);

  return (
    <AppShell title="Team Attendance">
      <div className={styles.page}>
        <div className={styles.header}>
          <h2 className={styles.title}>Team Attendance Overview</h2>
          <div className={styles.dateSelect}>
            <label>Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue} style={{ color: 'var(--success)' }}>
              {teamRecords.filter((r) => r.status === 'present' || r.status === 'remote').length}
            </span>
            <span className={styles.summaryLabel}>Present</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>
              {teamRecords.filter((r) => r.status === 'absent').length}
            </span>
            <span className={styles.summaryLabel}>Absent</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue} style={{ color: 'var(--warning)' }}>
              {teamRecords.filter((r) => r.status === 'half_day').length}
            </span>
            <span className={styles.summaryLabel}>Half Day</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue} style={{ color: 'var(--primary)' }}>
              {teamRecords.filter((r) => r.status === 'leave').length}
            </span>
            <span className={styles.summaryLabel}>On Leave</span>
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : error ? (
          <p style={{ color: 'var(--danger)', textAlign: 'center', padding: '2rem' }}>{error}</p>
        ) : (
          <TeamAttendanceTable records={teamRecords} />
        )}
      </div>
    </AppShell>
  );
}
