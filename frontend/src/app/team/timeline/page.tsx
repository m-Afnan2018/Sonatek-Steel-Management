'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import TaskModal from '@/components/tasks/TaskModal/TaskModal';
import { useAuthStore } from '@/store/authStore';
import { useTasks } from '@/hooks/useTasks';
import { useTeam } from '@/hooks/useTeam';
import api from '@/lib/api';
import type { Task } from '@/types';
import styles from './timeline.module.css';

// ── Types ──────────────────────────────────────────────────────────────────
interface TimerEvent { action: string; timestamp: string; }
interface TaskData   { _id: string; title: string; timerStatus: string; timerEvents: TimerEvent[]; }
interface AttData    { checkIn?: string | null; checkOut?: string | null; lunchStart?: string | null; lunchStop?: string | null; status: string; }
interface UserRowData { user: { id: string; name: string; role: string; }; attendance: AttData | null; tasks: TaskData[]; }

// ── Colour palette (hashed by task id) ────────────────────────────────────
const PALETTE = ['#6C63FF','#10b981','#0ea5e9','#f59e0b','#f97316','#8b5cf6','#ec4899','#14b8a6','#ef4444','#06b6d4'];
function taskColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (id.charCodeAt(i) + ((h << 5) - h)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Maths helpers ─────────────────────────────────────────────────────────
function pct(ts: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime();
  if (!total) return 0;
  return Math.max(0, Math.min(100, ((ts.getTime() - start.getTime()) / total) * 100));
}

function fmtHM(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Segment builder ───────────────────────────────────────────────────────
interface Seg { type: 'active' | 'hold'; start: Date; end: Date; taskId: string; label: string; }

function computeSegments(task: TaskData, now: Date): Seg[] {
  const segs: Seg[] = [];
  let openStart: Date | null = null;
  let openType: 'active' | 'hold' = 'active';

  for (const ev of task.timerEvents) {
    const ts = new Date(ev.timestamp);
    if (ev.action === 'start' || ev.action === 'resume') {
      openStart = ts;
      openType  = 'active';
    } else if (ev.action === 'hold') {
      if (openStart) {
        segs.push({ type: 'active', start: openStart, end: ts, taskId: task._id, label: task.title });
        openStart = ts;
        openType  = 'hold';
      }
    } else if (ev.action === 'pause' || ev.action === 'finish') {
      if (openStart) {
        segs.push({ type: openType, start: openStart, end: ts, taskId: task._id, label: task.title });
        openStart = null;
      }
    }
  }
  // Still open (task currently running / on hold)
  if (openStart) {
    segs.push({ type: openType, start: openStart, end: now, taskId: task._id, label: task.title });
  }
  return segs;
}

// ── Time-range calculation ─────────────────────────────────────────────────
function computeRange(rows: UserRowData[], baseDate: string, startHour: number): { start: Date; end: Date } {
  const base  = new Date(baseDate + 'T00:00:00');
  // Fixed start = chosen hour
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), startHour, 0, 0);

  // End = last checkout time; fall back to last timer event then to startHour+9
  let maxMs = new Date(base.getFullYear(), base.getMonth(), base.getDate(), startHour + 9, 0, 0).getTime();

  // Prefer checkout times as the hard end
  let hasCheckout = false;
  rows.forEach((r) => {
    if (r.attendance?.checkOut) {
      const t = new Date(r.attendance.checkOut).getTime();
      if (!hasCheckout || t > maxMs) { maxMs = t; hasCheckout = true; }
    }
  });

  // If nobody has checked out yet, extend to last task event or now
  if (!hasCheckout) {
    rows.forEach((r) => {
      r.tasks.forEach((t) =>
        t.timerEvents.forEach((e) => {
          const ts = new Date(e.timestamp).getTime();
          if (ts > maxMs) maxMs = ts;
        }),
      );
    });
  }

  // Round end up to next full hour + 30-min buffer
  const raw = new Date(maxMs + 30 * 60 * 1000);
  const end = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), raw.getHours() + 1, 0, 0);

  return { start, end };
}

function generateTicks(start: Date, end: Date): Array<{ label: string; left: number }> {
  const ticks: Array<{ label: string; left: number }> = [];
  const cur = new Date(start);
  cur.setMinutes(0, 0, 0);
  if (cur < start) cur.setHours(cur.getHours() + 1);
  while (cur <= end) {
    ticks.push({ label: fmtHM(cur), left: pct(cur, start, end) });
    cur.setHours(cur.getHours() + 1);
  }
  return ticks;
}

// ── Status helpers ────────────────────────────────────────────────────────
function userStatus(row: UserRowData): { label: string; color: string } {
  if (row.tasks.some((t) => t.timerStatus === 'running'))  return { label: 'Working',     color: '#10b981' };
  if (row.attendance?.lunchStart && !row.attendance?.lunchStop) return { label: 'On Lunch', color: '#f59e0b' };
  if (row.attendance?.checkIn && !row.attendance?.checkOut)     return { label: 'Present',  color: '#6C63FF' };
  if (row.attendance?.checkOut)                                  return { label: 'Checked Out', color: '#6b7280' };
  return { label: 'Away', color: '#6b7280' };
}

// ── Minimum track width (px) ──────────────────────────────────────────────
const MIN_TRACK_PX = 860;

// ──────────────────────────────────────────────────────────────────────────
export default function UsersTimelinePage() {
  const currentUser = useAuthStore((s) => s.user);
  const [date, setDate]   = useState(todayISO);
  const [rows, setRows]   = useState<UserRowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');

  const [startHour, setStartHour] = useState<9 | 10>(9);

  // Task modal
  const { patchTimer } = useTasks();
  const { members } = useTeam();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const handleTaskBlockClick = useCallback(async (taskId: string) => {
    try {
      const { data } = await api.get(`/tasks/${taskId}`);
      setSelectedTask(data);
    } catch {
      // fallback: find task data already in rows
      const found = rows.flatMap((r) => r.tasks).find((t) => t._id === taskId);
      if (found) setSelectedTask(found as unknown as Task);
    }
    setShowTaskModal(true);
  }, [rows]);

  const isToday = date === todayISO();
  const now     = new Date();

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get(`/attendance/team/timeline?date=${d}`);
      setRows(data);
    } catch {
      setErr('Failed to load timeline data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => computeRange(rows, date, startHour), [rows, date, startHour]);
  const ticks   = useMemo(() => generateTicks(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const nowPct  = isToday ? pct(now, rangeStart, rangeEnd) : -1;

  // Summary counts
  const working    = rows.filter((r) => r.tasks.some((t) => t.timerStatus === 'running')).length;
  const onLunch    = rows.filter((r) => r.attendance?.lunchStart && !r.attendance?.lunchStop).length;
  const checkedIn  = rows.filter((r) => r.attendance?.checkIn && !r.attendance?.checkOut).length;

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return (
      <AppShell title="Users Timeline">
        <div className={styles.denied}>Admin / Manager access only.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Users Timeline">
      <div className={styles.page}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Users Timeline</h2>
            <p className={styles.subtitle}>Daily activity — who's working on what, and when</p>
          </div>
          <div className={styles.headerControls}>
            <div className={styles.startToggle}>
              <button
                className={`${styles.toggleBtn} ${startHour === 9 ? styles.toggleActive : ''}`}
                onClick={() => setStartHour(9)}
              >
                From 9:00
              </button>
              <button
                className={`${styles.toggleBtn} ${startHour === 10 ? styles.toggleActive : ''}`}
                onClick={() => setStartHour(10)}
              >
                From 10:00
              </button>
            </div>
            <input
              type="date"
              className={styles.datePicker}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────── */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statDot} style={{ background: '#10b981' }} />
            <span className={styles.statNum}>{working}</span>
            <span className={styles.statLabel}>Working now</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statDot} style={{ background: '#f59e0b' }} />
            <span className={styles.statNum}>{onLunch}</span>
            <span className={styles.statLabel}>On lunch</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statDot} style={{ background: '#6C63FF' }} />
            <span className={styles.statNum}>{checkedIn}</span>
            <span className={styles.statLabel}>Checked in</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statDot} style={{ background: 'var(--border)' }} />
            <span className={styles.statNum}>{rows.length}</span>
            <span className={styles.statLabel}>Tracked today</span>
          </div>
        </div>

        {/* ── Legend ───────────────────────────────────────────── */}
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: '#10b98118', border: '1px solid #10b981' }} />
            Work window
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: '#6C63FF' }} />
            Task active
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.legendHatch}`} style={{ borderColor: '#f97316' }} />
            Task on hold
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: '#f59e0b' }} />
            Lunch break
          </span>
          {isToday && (
            <span className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: '#ef4444', width: 3, borderRadius: 99 }} />
              Now
            </span>
          )}
        </div>

        {/* ── Timeline ─────────────────────────────────────────── */}
        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : err ? (
          <p className={styles.errMsg}>{err}</p>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>No activity recorded for this date.</div>
        ) : (
          <div className={styles.wrapper}>
            <div className={styles.inner}>

              {/* Ruler */}
              <div className={styles.rulerRow}>
                <div className={`${styles.nameCol} ${styles.rulerName}`}>
                  <span>Member</span>
                </div>
                <div className={styles.rulerTrack} style={{ minWidth: MIN_TRACK_PX }}>
                  {ticks.map((t) => (
                    <div key={t.label} className={styles.tick} style={{ left: `${t.left}%` }}>
                      <span className={styles.tickLabel}>{t.label}</span>
                      <span className={styles.tickLine} />
                    </div>
                  ))}
                  {/* Now line in ruler */}
                  {nowPct > 0 && nowPct < 100 && (
                    <div className={styles.nowRuler} style={{ left: `${nowPct}%` }} />
                  )}
                </div>
              </div>

              {/* User rows */}
              {rows.map((row) => {
                const allSegs = row.tasks.flatMap((t) => computeSegments(t, now));
                const wStart  = row.attendance?.checkIn  ? new Date(row.attendance.checkIn)  : null;
                const wEnd    = row.attendance?.checkOut ? new Date(row.attendance.checkOut) : (wStart ? now : null);
                const lStart  = row.attendance?.lunchStart ? new Date(row.attendance.lunchStart) : null;
                const lEnd    = row.attendance?.lunchStop  ? new Date(row.attendance.lunchStop)  : (lStart ? now : null);
                const { label: stLabel, color: stColor } = userStatus(row);

                return (
                  <div key={row.user.id} className={styles.row}>
                    {/* Name column */}
                    <div className={`${styles.nameCol} ${styles.userNameCol}`}>
                      <div className={styles.avatarWrap}>
                        <Avatar name={row.user.name} size="sm" />
                        <span className={styles.statusDot} style={{ background: stColor }} title={stLabel} />
                      </div>
                      <div className={styles.userMeta}>
                        <span className={styles.userName}>{row.user.name}</span>
                        <span className={styles.userSt} style={{ color: stColor }}>{stLabel}</span>
                      </div>
                    </div>

                    {/* Track */}
                    <div
                      className={styles.track}
                      style={{
                        minWidth: MIN_TRACK_PX,
                        ...(nowPct > 0 && nowPct < 100 ? { '--now-pct': `${nowPct}%` } as React.CSSProperties : {}),
                      }}
                    >
                      {/* Work window */}
                      {wStart && wEnd && (
                        <div
                          className={styles.workBg}
                          style={{
                            left:  `${pct(wStart, rangeStart, rangeEnd)}%`,
                            width: `${pct(wEnd, rangeStart, rangeEnd) - pct(wStart, rangeStart, rangeEnd)}%`,
                          }}
                          title={`Check-in: ${fmtHM(wStart)}${row.attendance?.checkOut ? `  →  Check-out: ${fmtHM(wEnd)}` : '  (still in)'}`}
                        />
                      )}

                      {/* Check-in marker */}
                      {wStart && (
                        <div
                          className={styles.markerIn}
                          style={{ left: `${pct(wStart, rangeStart, rangeEnd)}%` }}
                          title={`Check-in: ${fmtHM(wStart)}`}
                        />
                      )}

                      {/* Check-out marker */}
                      {wEnd && row.attendance?.checkOut && (
                        <div
                          className={styles.markerOut}
                          style={{ left: `${pct(wEnd, rangeStart, rangeEnd)}%` }}
                          title={`Check-out: ${fmtHM(wEnd)}`}
                        />
                      )}

                      {/* Task segments */}
                      {allSegs.map((seg, i) => {
                        const color    = taskColor(seg.taskId);
                        const isHold   = seg.type === 'hold';
                        const leftPct  = pct(seg.start, rangeStart, rangeEnd);
                        const widthPct = pct(seg.end,   rangeStart, rangeEnd) - leftPct;
                        if (widthPct < 0.15) return null;
                        return (
                          <div
                            key={`${seg.taskId}-${i}`}
                            className={`${styles.taskBlock} ${isHold ? styles.taskHold : ''}`}
                            style={{
                              left:        `${leftPct}%`,
                              width:       `${widthPct}%`,
                              background:  isHold ? `${color}15` : `${color}28`,
                              borderColor: isHold ? `${color}80` : color,
                              color,
                              cursor: 'pointer',
                            }}
                            title={`${seg.label}\n${fmtHM(seg.start)} → ${fmtHM(seg.end)}${isHold ? '\n(on hold)' : ''}`}
                            onClick={() => handleTaskBlockClick(seg.taskId)}
                          >
                            <span className={styles.taskLabel}>{seg.label}</span>
                          </div>
                        );
                      })}

                      {/* Lunch block */}
                      {lStart && lEnd && (
                        <div
                          className={styles.lunchBlock}
                          style={{
                            left:  `${pct(lStart, rangeStart, rangeEnd)}%`,
                            width: `${pct(lEnd, rangeStart, rangeEnd) - pct(lStart, rangeStart, rangeEnd)}%`,
                          }}
                          title={`Lunch: ${fmtHM(lStart)} → ${row.attendance?.lunchStop ? fmtHM(lEnd) : 'ongoing'}`}
                        />
                      )}

                      {/* "Now" line */}
                      {nowPct > 0 && nowPct < 100 && (
                        <div className={styles.nowLine} style={{ left: `${nowPct}%` }} />
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        )}
      </div>

      <TaskModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        onUpdate={(updated) => setSelectedTask(updated)}
        members={members}
        patchTimer={patchTimer}
      />
    </AppShell>
  );
}
