'use client';

import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar/AttendanceCalendar';
import CheckInButton from '@/components/attendance/CheckInButton/CheckInButton';
import AttendanceStats from '@/components/attendance/AttendanceStats/AttendanceStats';
import CalendarEventsPanel from '@/components/attendance/CalendarEventsPanel/CalendarEventsPanel';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useAttendance } from '@/hooks/useAttendance';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import styles from './attendance.module.css';

export default function AttendancePage() {
  const { records, stats, loading, fetchMyAttendance, fetchUserAttendance, fetchStats, fetchUserStats } = useAttendance();
  const { events, fetchEvents, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Admin only: can view calendar of any user
  const [viewUserId, setViewUserId] = useState<string>('');

  useEffect(() => {
    if (isAdmin && viewUserId) {
      fetchUserAttendance(viewUserId, month, year);
      fetchUserStats(viewUserId, month, year);
    } else {
      fetchMyAttendance(month, year);
      fetchStats(month, year);
    }
  }, [month, year, viewUserId, isAdmin, fetchMyAttendance, fetchUserAttendance, fetchStats, fetchUserStats]);

  useEffect(() => {
    fetchEvents(month, year, viewUserId || undefined);
  }, [month, year, viewUserId, fetchEvents]);

  const handlePrevMonth = () => {
    setSelectedDay(null);
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    setSelectedDay(null);
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const teamMembers = useMemo(() => members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    avatar: m.avatar,
  })), [members]);

  return (
    <AppShell title="My Attendance">
      <div className={styles.page}>
        <div className={styles.grid}>
          <div className={styles.main}>
            <div className={styles.calendarHeader}>
              <button className={styles.navBtn} onClick={handlePrevMonth}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h2 className={styles.monthTitle}>
                {monthNames[month - 1]} {year}
              </h2>
              <button className={styles.navBtn} onClick={handleNextMonth}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {isAdmin && members.length > 0 && (
              <div className={styles.viewSelector}>
                <label className={styles.viewLabel}>Viewing calendar of:</label>
                <select
                  className={styles.viewSelect}
                  value={viewUserId}
                  onChange={(e) => { setViewUserId(e.target.value); setSelectedDay(null); }}
                >
                  <option value="">Myself</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className={styles.loading}><Spinner /></div>
            ) : (
              <AttendanceCalendar
                records={records}
                month={month}
                year={year}
                onRecordUpdate={() => fetchMyAttendance(month, year)}
                events={events}
                onDaySelect={setSelectedDay}
                selectedExternalDay={selectedDay}
              />
            )}

            {selectedDay && (
              <CalendarEventsPanel
                selectedDay={selectedDay}
                events={events}
                currentUser={{ id: user?.id || '', role: user?.role || 'member' }}
                members={teamMembers}
                onClose={() => setSelectedDay(null)}
                onCreate={(p) => createEvent(p as Record<string, unknown>)}
                onUpdate={(id, p) => updateEvent(id, p as Record<string, unknown>)}
                onDelete={deleteEvent}
              />
            )}
          </div>

          <div className={styles.sidebar}>
            <CheckInButton
              viewUserId={viewUserId || undefined}
              viewUserName={members.find((m) => m.id === viewUserId)?.name}
            />
            <AttendanceStats stats={stats} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
