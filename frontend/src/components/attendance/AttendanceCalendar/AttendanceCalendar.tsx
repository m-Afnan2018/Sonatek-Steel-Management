'use client';

import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import { useAttendance } from '@/hooks/useAttendance';
import type { Attendance, CalendarEvent } from '@/types';
import styles from './AttendanceCalendar.module.css';
import { Pencil } from 'lucide-react';

interface AttendanceCalendarProps {
  records: Attendance[];
  month: number;
  year: number;
  onRecordUpdate?: () => void;
  events?: CalendarEvent[];
  onDaySelect?: (day: Date) => void;
  selectedExternalDay?: Date | null;
  isAdmin?: boolean;
  viewUserId?: string;
  onAdminUpdate?: (id: string, payload: Record<string, unknown>) => Promise<Attendance | null>;
  onAdminCreate?: (payload: Record<string, unknown>) => Promise<Attendance | null>;
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

// Helper: extract "HH:MM" from an ISO date string
function toTimeInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Helper: combine a date (YYYY-MM-DD) with a time "HH:MM" → ISO string
function combineDatetime(dateIso: string, time: string): string {
  const base = dateIso.split('T')[0];
  return new Date(`${base}T${time}:00`).toISOString();
}

export default function AttendanceCalendar({ records, month, year, onRecordUpdate, events = [], onDaySelect, selectedExternalDay, isAdmin, viewUserId, onAdminUpdate, onAdminCreate }: AttendanceCalendarProps) {
  const { addNote, deleteNote } = useAttendance();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [noteText, setNoteText] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [deletingNote, setDeletingNote] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Admin edit state
  const [adminEditing, setAdminEditing] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [editForm, setEditForm] = useState({
    status: 'present',
    workMode: 'office',
    isLate: false,
    checkIn: '',
    checkOut: '',
    lunchStart: '',
    lunchStop: '',
  });

  const days = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [month, year]);

  const firstDayOffset = getDay(days[0]);

  const getRecord = (day: Date) => records.find((r) => isSameDay(new Date(r.date), day));

  const getEventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.date), day));

  // Single click — select the day (highlights it, updates sidebar)
  const handleDayClick = (day: Date) => {
    setSelectedDay((prev) => (prev && isSameDay(prev, day) ? prev : day));
    if (onDaySelect) onDaySelect(day);
  };

  // Double click — open the detail modal
  const handleDayDoubleClick = (day: Date) => {
    const record = getRecord(day);
    setSelectedDay(day);
    setSelectedRecord(record || null);
    setNoteText('');
    setLinkInput('');
    setLinks([]);
    setNoteError('');
    setAdminEditing(false);
    setAdminError('');
    setModalOpen(true);
    if (onDaySelect) onDaySelect(day);
  };

  const openAdminEdit = () => {
    setEditForm({
      status: selectedRecord?.status || 'present',
      workMode: selectedRecord?.workMode || 'office',
      isLate: selectedRecord?.isLate || false,
      checkIn: toTimeInput(selectedRecord?.checkIn),
      checkOut: toTimeInput(selectedRecord?.checkOut),
      lunchStart: toTimeInput(selectedRecord?.lunchStart),
      lunchStop: toTimeInput(selectedRecord?.lunchStop),
    });
    setAdminEditing(true);
    setAdminError('');
  };

  const handleAdminSave = async () => {
    if (!selectedDay) return;
    setAdminSaving(true);
    setAdminError('');

    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const payload: Record<string, unknown> = {
      status: editForm.status,
      workMode: editForm.workMode,
      isLate: editForm.isLate,
      checkIn: editForm.checkIn ? combineDatetime(dateStr, editForm.checkIn) : null,
      checkOut: editForm.checkOut ? combineDatetime(dateStr, editForm.checkOut) : null,
      lunchStart: editForm.lunchStart ? combineDatetime(dateStr, editForm.lunchStart) : null,
      lunchStop: editForm.lunchStop ? combineDatetime(dateStr, editForm.lunchStop) : null,
    };

    let result: Attendance | null = null;
    if (selectedRecord) {
      result = onAdminUpdate ? await onAdminUpdate(selectedRecord._id, payload) : null;
    } else {
      const targetUserId = viewUserId;
      if (!targetUserId) { setAdminError('No user selected.'); setAdminSaving(false); return; }
      result = onAdminCreate ? await onAdminCreate({ ...payload, userId: targetUserId, date: dateStr }) : null;
    }

    setAdminSaving(false);
    if (result) {
      setSelectedRecord(result);
      setAdminEditing(false);
      if (onRecordUpdate) onRecordUpdate();
    } else {
      setAdminError('Failed to save. Please try again.');
    }
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
            const isWeekend = getDay(day) === 0; // Sunday only
            const isSelected = (selectedDay && isSameDay(day, selectedDay)) || (selectedExternalDay && isSameDay(day, selectedExternalDay));

            return (
              <div
                key={day.toISOString()}
                className={`${styles.day} ${isWeekend ? styles.weekend : ''} ${isSelected ? styles.selected : ''}`}
                onClick={() => handleDayClick(day)}
                onDoubleClick={() => handleDayDoubleClick(day)}
                title="Double-click to open details"
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

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setAdminEditing(false); }}
        title={selectedDay ? format(selectedDay, 'EEEE, MMMM d') : ''}
        size="sm"
      >
        {selectedDay && (
          selectedRecord ? (
            <div className={styles.recordInfo}>
              {/* Admin edit toolbar */}
              {isAdmin && !adminEditing && (
                <button className={styles.adminEditBtn} onClick={openAdminEdit}>
                  <Pencil size={13} />
                  Edit Record
                </button>
              )}

              {/* Admin edit form */}
              {isAdmin && adminEditing && (
                <div className={styles.adminForm}>
                  <div className={styles.adminFormRow}>
                    <label>Status</label>
                    <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="half_day">Half Day</option>
                      <option value="remote">Remote</option>
                      <option value="leave">Leave</option>
                      <option value="late">Late</option>
                    </select>
                  </div>
                  <div className={styles.adminFormRow}>
                    <label>Work Mode</label>
                    <select value={editForm.workMode} onChange={(e) => setEditForm((f) => ({ ...f, workMode: e.target.value }))}>
                      <option value="office">Office</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className={styles.adminFormGrid}>
                    <div className={styles.adminFormRow}>
                      <label>Check-in</label>
                      <input type="time" value={editForm.checkIn} onChange={(e) => setEditForm((f) => ({ ...f, checkIn: e.target.value }))} />
                    </div>
                    <div className={styles.adminFormRow}>
                      <label>Check-out</label>
                      <input type="time" value={editForm.checkOut} onChange={(e) => setEditForm((f) => ({ ...f, checkOut: e.target.value }))} />
                    </div>
                    <div className={styles.adminFormRow}>
                      <label>Lunch Start</label>
                      <input type="time" value={editForm.lunchStart} onChange={(e) => setEditForm((f) => ({ ...f, lunchStart: e.target.value }))} />
                    </div>
                    <div className={styles.adminFormRow}>
                      <label>Lunch End</label>
                      <input type="time" value={editForm.lunchStop} onChange={(e) => setEditForm((f) => ({ ...f, lunchStop: e.target.value }))} />
                    </div>
                  </div>
                  <label className={styles.adminCheckRow}>
                    <input type="checkbox" checked={editForm.isLate} onChange={(e) => setEditForm((f) => ({ ...f, isLate: e.target.checked }))} />
                    Mark as Late
                  </label>
                  {adminError && <p className={styles.adminError}>{adminError}</p>}
                  <div className={styles.adminFormActions}>
                    <button className={styles.adminCancelBtn} onClick={() => setAdminEditing(false)}>Cancel</button>
                    <button className={styles.adminSaveBtn} onClick={handleAdminSave} disabled={adminSaving}>
                      {adminSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                  <p className={styles.adminNote}>Hours worked will be recalculated automatically.</p>
                </div>
              )}
              <div className={styles.recordGrid}>
                <div className={styles.recordRow}>
                  <span className={styles.rowLabel}>Status</span>
                  <strong className={styles.recordStatus} style={{ color: statusColors[selectedRecord.status] }}>
                    {selectedRecord.status.replace('_', ' ')}
                    {selectedRecord.isLate && <span className={styles.lateBadge}>Late</span>}
                  </strong>
                </div>
                {selectedRecord.checkIn && (
                  <div className={styles.recordRow}>
                    <span className={styles.rowLabel}>Check-in</span>
                    <strong>{new Date(selectedRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                )}
                {selectedRecord.checkOut && (
                  <div className={styles.recordRow}>
                    <span className={styles.rowLabel}>Check-out</span>
                    <strong>{new Date(selectedRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                )}
                {selectedRecord.lunchStart && (
                  <div className={styles.recordRow}>
                    <span className={styles.rowLabel}>Lunch</span>
                    <strong>
                      {new Date(selectedRecord.lunchStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {selectedRecord.lunchStop && ` → ${new Date(selectedRecord.lunchStop).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </strong>
                  </div>
                )}
                {selectedRecord.hoursWorked > 0 && (
                  <div className={styles.recordRow}>
                    <span className={styles.rowLabel}>Hours</span>
                    <strong>{selectedRecord.hoursWorked.toFixed(1)}h</strong>
                  </div>
                )}
              </div>

              {selectedRecord.notes && selectedRecord.notes.length > 0 && (
                <div className={styles.notesList}>
                  <p className={styles.notesLabel}>Notes</p>
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
                          {deletingNote === i ? '…' : '×'}
                        </button>
                      </div>
                      {note.links.map((l, j) => (
                        <a key={j} href={l} target="_blank" rel="noopener noreferrer" className={styles.noteLink}>{l}</a>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.addNote}>
                <p className={styles.addNoteLabel}>Add a note</p>
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
                        {l.length > 30 ? l.substring(0, 30) + '…' : l}
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
            <div className={styles.noRecordWrap}>
              <p className={styles.noRecord}>No attendance record for this day.</p>
              {isAdmin && viewUserId && (
                adminEditing ? (
                  <div className={styles.adminForm}>
                    <div className={styles.adminFormRow}>
                      <label>Status</label>
                      <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="half_day">Half Day</option>
                        <option value="remote">Remote</option>
                        <option value="leave">Leave</option>
                        <option value="late">Late</option>
                      </select>
                    </div>
                    <div className={styles.adminFormRow}>
                      <label>Work Mode</label>
                      <select value={editForm.workMode} onChange={(e) => setEditForm((f) => ({ ...f, workMode: e.target.value }))}>
                        <option value="office">Office</option>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div className={styles.adminFormGrid}>
                      <div className={styles.adminFormRow}>
                        <label>Check-in</label>
                        <input type="time" value={editForm.checkIn} onChange={(e) => setEditForm((f) => ({ ...f, checkIn: e.target.value }))} />
                      </div>
                      <div className={styles.adminFormRow}>
                        <label>Check-out</label>
                        <input type="time" value={editForm.checkOut} onChange={(e) => setEditForm((f) => ({ ...f, checkOut: e.target.value }))} />
                      </div>
                      <div className={styles.adminFormRow}>
                        <label>Lunch Start</label>
                        <input type="time" value={editForm.lunchStart} onChange={(e) => setEditForm((f) => ({ ...f, lunchStart: e.target.value }))} />
                      </div>
                      <div className={styles.adminFormRow}>
                        <label>Lunch End</label>
                        <input type="time" value={editForm.lunchStop} onChange={(e) => setEditForm((f) => ({ ...f, lunchStop: e.target.value }))} />
                      </div>
                    </div>
                    <label className={styles.adminCheckRow}>
                      <input type="checkbox" checked={editForm.isLate} onChange={(e) => setEditForm((f) => ({ ...f, isLate: e.target.checked }))} />
                      Mark as Late
                    </label>
                    {adminError && <p className={styles.adminError}>{adminError}</p>}
                    <div className={styles.adminFormActions}>
                      <button className={styles.adminCancelBtn} onClick={() => setAdminEditing(false)}>Cancel</button>
                      <button className={styles.adminSaveBtn} onClick={handleAdminSave} disabled={adminSaving}>
                        {adminSaving ? 'Saving…' : 'Create Record'}
                      </button>
                    </div>
                    <p className={styles.adminNote}>Hours worked will be calculated automatically.</p>
                  </div>
                ) : (
                  <button className={styles.adminCreateBtn} onClick={openAdminEdit}>
                    + Create Attendance Record
                  </button>
                )
              )}
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
