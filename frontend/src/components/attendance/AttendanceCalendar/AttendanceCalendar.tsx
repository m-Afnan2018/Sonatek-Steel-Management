'use client';

import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import Button from '@/components/ui/Button/Button';
import { useAttendance } from '@/hooks/useAttendance';
import type { Attendance, CalendarEvent } from '@/types';
import styles from './AttendanceCalendar.module.css';

interface AttendanceCalendarProps {
  records: Attendance[];
  month: number;
  year: number;
  onRecordUpdate?: () => void;
  events?: CalendarEvent[];
  onDaySelect?: (day: Date) => void;
  selectedExternalDay?: Date | null;
}

const statusColors: Record<string, string> = {
  present: 'var(--success)',
  absent: 'var(--danger)',
  half_day: 'var(--warning)',
  remote: 'var(--primary)',
  leave: 'var(--danger)',
  late: 'var(--warning)',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendanceCalendar({ records, month, year, onRecordUpdate, events = [], onDaySelect, selectedExternalDay }: AttendanceCalendarProps) {
  const { addNote, deleteNote } = useAttendance();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [noteText, setNoteText] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [deletingNote, setDeletingNote] = useState<number | null>(null);

  const days = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [month, year]);

  const firstDayOffset = getDay(days[0]);

  const getRecord = (day: Date) => records.find((r) => isSameDay(new Date(r.date), day));

  const getEventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.date), day));

  const handleDayClick = (day: Date) => {
    const record = getRecord(day);
    setSelectedDay(day);
    setSelectedRecord(record || null);
    setNoteText('');
    setLinkInput('');
    setLinks([]);
    setNoteError('');
    if (onDaySelect) onDaySelect(day);
  };

  const handleAddNote = async () => {
    if (!selectedDay || !noteText.trim()) return;
    setSaving(true);
    setNoteError('');
    const result = await addNote(format(selectedDay, 'yyyy-MM-dd'), noteText, [], links);
    setSaving(false);
    if (result.error) {
      setNoteError(result.error);
    } else {
      setNoteText('');
      setLinks([]);
      // Update the in-panel record immediately
      if (result.data) setSelectedRecord(result.data);
      if (onRecordUpdate) onRecordUpdate();
    }
  };

  const handleDeleteNote = async (noteIndex: number) => {
    if (!selectedRecord) return;
    setDeletingNote(noteIndex);
    const updated = await deleteNote(selectedRecord._id, noteIndex);
    setDeletingNote(null);
    if (updated) {
      setSelectedRecord(updated);
      if (onRecordUpdate) onRecordUpdate();
    }
  };

  const addLink = () => {
    if (linkInput.trim()) {
      setLinks((prev) => [...prev, linkInput.trim()]);
      setLinkInput('');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.calendar}>
        <div className={styles.header}>
          {DAYS.map((d) => (
            <div key={d} className={styles.dayHeader}>{d}</div>
          ))}
        </div>
        <div className={styles.grid}>
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className={styles.empty} />
          ))}
          {days.map((day) => {
            const record = getRecord(day);
            const dayEvts = getEventsForDay(day);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            const isSelected = (selectedDay && isSameDay(day, selectedDay)) || (selectedExternalDay && isSameDay(day, selectedExternalDay));

            return (
              <div
                key={day.toISOString()}
                className={`${styles.day} ${isWeekend ? styles.weekend : ''} ${isSelected ? styles.selected : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <span className={styles.dayNumber}>{format(day, 'd')}</span>
                <div className={styles.indicators}>
                  {record && (
                    <>
                      <div
                        className={styles.indicator}
                        style={{ background: statusColors[record.status] || 'var(--success)' }}
                        title={`${record.status}${record.hoursWorked ? ` - ${record.hoursWorked}h` : ''}`}
                      />
                      {record.isLate && (
                        <div
                          className={`${styles.indicator} ${styles.lateIndicator}`}
                          title="Late check-in"
                        />
                      )}
                      {record.notes && record.notes.length > 0 && (
                        <div className={styles.noteIndicator} title={`${record.notes.length} note(s)`} />
                      )}
                    </>
                  )}
                  {dayEvts.slice(0, 3).map((ev) => (
                    <div
                      key={ev._id}
                      className={styles.eventDot}
                      style={{ background: ev.color }}
                      title={ev.title}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}><span className={styles.dot} style={{ background: 'var(--success)' }} /> Present</div>
        <div className={styles.legendItem}><span className={styles.dot} style={{ background: 'var(--warning)' }} /> Late</div>
        <div className={styles.legendItem}><span className={styles.dot} style={{ background: 'var(--primary)' }} /> Remote</div>
        <div className={styles.legendItem}><span className={styles.dot} style={{ background: 'var(--danger)' }} /> Absent</div>
        <div className={styles.legendItem}><span className={`${styles.dot} ${styles.noteDot}`} /> Has Notes</div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className={styles.dayPanel}>
          <div className={styles.panelHeader}>
            <h4 className={styles.panelDate}>{format(selectedDay, 'EEEE, MMMM d')}</h4>
            <button className={styles.closeBtn} onClick={() => setSelectedDay(null)}>×</button>
          </div>

          {selectedRecord ? (
            <div className={styles.recordInfo}>
              <div className={styles.recordRow}>
                <span>Status:</span>
                <strong className={styles.recordStatus} style={{ color: statusColors[selectedRecord.status] }}>
                  {selectedRecord.status} {selectedRecord.isLate && '(Late)'}
                </strong>
              </div>
              {selectedRecord.checkIn && (
                <div className={styles.recordRow}>
                  <span>Check-in:</span>
                  <strong>{new Date(selectedRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
              )}
              {selectedRecord.checkOut && (
                <div className={styles.recordRow}>
                  <span>Check-out:</span>
                  <strong>{new Date(selectedRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
              )}
              {selectedRecord.lunchStart && (
                <div className={styles.recordRow}>
                  <span>Lunch:</span>
                  <strong>
                    {new Date(selectedRecord.lunchStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {selectedRecord.lunchStop && ` → ${new Date(selectedRecord.lunchStop).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </strong>
                </div>
              )}
              {selectedRecord.hoursWorked > 0 && (
                <div className={styles.recordRow}>
                  <span>Hours:</span>
                  <strong>{selectedRecord.hoursWorked.toFixed(1)}h</strong>
                </div>
              )}

              {/* Notes list with delete */}
              {selectedRecord.notes && selectedRecord.notes.length > 0 && (
                <div className={styles.notesList}>
                  <p className={styles.notesLabel}>Notes:</p>
                  {selectedRecord.notes.map((note, i) => (
                    <div key={i} className={styles.noteEntry}>
                      <div className={styles.noteEntryHeader}>
                        <p className={styles.noteContent}>{note.content}</p>
                        <button
                          className={styles.deleteNoteBtn}
                          onClick={() => handleDeleteNote(i)}
                          disabled={deletingNote === i}
                          title="Delete note"
                        >
                          {deletingNote === i ? '...' : '×'}
                        </button>
                      </div>
                      {note.links.map((l, j) => (
                        <a key={j} href={l} target="_blank" rel="noopener noreferrer" className={styles.noteLink}>{l}</a>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Add note form — only when record exists */}
              <div className={styles.addNote}>
                <p className={styles.addNoteLabel}>Add a note:</p>
                <textarea
                  rows={2}
                  placeholder="Write a note for this day..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className={styles.noteInput}
                />
                <div className={styles.linkRow}>
                  <input
                    placeholder="Add a link (optional)..."
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLink()}
                    className={styles.linkInput}
                  />
                  <button className={styles.addLinkBtn} onClick={addLink}>+</button>
                </div>
                {links.length > 0 && (
                  <div className={styles.linkChips}>
                    {links.map((l, i) => (
                      <span key={i} className={styles.linkChip}>
                        {l.substring(0, 30)}...
                        <button onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                {noteError && <p className={styles.noteError}>{noteError}</p>}
                <Button size="sm" onClick={handleAddNote} loading={saving} disabled={!noteText.trim()}>
                  Save Note
                </Button>
              </div>
            </div>
          ) : (
            <p className={styles.noRecord}>No attendance record for this day. Check in first to add notes.</p>
          )}
        </div>
      )}
    </div>
  );
}
