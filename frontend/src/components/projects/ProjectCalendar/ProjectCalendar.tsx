'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  ChangeEvent,
} from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Spinner from '@/components/ui/Spinner/Spinner';
import { cn } from '@/lib/utils';
import styles from './ProjectCalendar.module.css';

/* ── Types ──────────────────────────────────────────────────────────── */

interface CalEventAttachment {
  name: string;
  url: string;
  mimeType: string;
  fileType: 'image' | 'video' | 'document' | 'other';
}

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  note?: string;
  type: 'meeting' | 'reminder' | 'event' | 'deadline';
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  color: string;
  location?: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  attachments: CalEventAttachment[];
  createdBy?: { id: string; name: string };
}

interface MediaItem {
  _id: string;
  name: string;
  url: string;
  mimeType: string;
  fileType: 'image' | 'document' | 'archive' | 'other';
  source: 'library' | 'task';
}

type ModalTab = 'details' | 'note' | 'attachments';

interface EventFormState {
  title: string;
  type: CalendarEvent['type'];
  color: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  recurrence: CalendarEvent['recurrence'];
  note: string;
  attachments: CalEventAttachment[];
}

/* ── Constants ──────────────────────────────────────────────────────── */

const STATIC_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
).replace(/\/api$/, '');

const COLOR_OPTIONS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EMPTY_FORM: EventFormState = {
  title: '',
  type: 'event',
  color: COLOR_OPTIONS[6],
  date: '',
  allDay: true,
  startTime: '',
  endTime: '',
  location: '',
  description: '',
  recurrence: 'none',
  note: '',
  attachments: [],
};

/* ── Helpers ────────────────────────────────────────────────────────── */

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isoToDateStr(iso: string): string {
  return iso.slice(0, 10);
}

function buildCalendarGrid(year: number, month: number): Array<{ date: Date; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }
  return cells;
}

function formatDayHeading(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function fileTypeFromMime(mimeType: string): CalEventAttachment['fileType'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('word') ||
    mimeType.includes('document')
  )
    return 'document';
  return 'other';
}

function AttachmentFileIcon({ fileType }: { fileType: CalEventAttachment['fileType'] }) {
  if (fileType === 'image') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    );
  }
  if (fileType === 'video') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    );
  }
  if (fileType === 'document') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

/* ── Main Component ─────────────────────────────────────────────────── */

interface ProjectCalendarProps {
  projectId: string;
}

export default function ProjectCalendar({ projectId }: ProjectCalendarProps) {
  const { user } = useAuthStore();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  );

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // View modal
  const [viewEvent, setViewEvent] = useState<CalendarEvent | null>(null);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('details');
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Media picker state
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch events ─────────────────────────────────────────────────── */

  const fetchEvents = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const { data } = await api.get<CalendarEvent[]>(
        `/projects/${projectId}/calendar`,
        { params: { month: month + 1, year } }
      );
      setEvents(data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEvents(viewYear, viewMonth);
  }, [fetchEvents, viewYear, viewMonth]);

  /* ── Navigation ───────────────────────────────────────────────────── */

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()));
  }

  /* ── Calendar grid data ───────────────────────────────────────────── */

  const cells = buildCalendarGrid(viewYear, viewMonth);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const key = isoToDateStr(ev.date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  /* ── Modal helpers ────────────────────────────────────────────────── */

  function openCreateModal() {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, date: selectedDate });
    setModalTab('details');
    setModalOpen(true);
  }

  function openEditModal(ev: CalendarEvent) {
    setViewEvent(null);
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      type: ev.type,
      color: ev.color,
      date: isoToDateStr(ev.date),
      allDay: ev.allDay,
      startTime: ev.startTime ?? '',
      endTime: ev.endTime ?? '',
      location: ev.location ?? '',
      description: ev.description ?? '',
      recurrence: ev.recurrence,
      note: ev.note ?? '',
      attachments: ev.attachments ?? [],
    });
    setModalTab('details');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEvent(null);
  }

  function setField<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  /* ── Save / delete ────────────────────────────────────────────────── */

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        type: form.type,
        color: form.color,
        date: form.date,
        allDay: form.allDay,
        startTime: form.allDay ? undefined : form.startTime || undefined,
        endTime: form.allDay ? undefined : form.endTime || undefined,
        location: form.location || undefined,
        description: form.description || undefined,
        recurrence: form.recurrence,
        note: form.note || undefined,
        attachments: form.attachments,
      };
      if (editingEvent) {
        await api.put(`/projects/${projectId}/calendar/${editingEvent._id}`, body);
      } else {
        await api.post(`/projects/${projectId}/calendar`, body);
      }
      await fetchEvents(viewYear, viewMonth);
      closeModal();
    } catch {
      // silently handle
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev: CalendarEvent) {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    try {
      await api.delete(`/projects/${projectId}/calendar/${ev._id}`);
      setEvents(prev => prev.filter(e => e._id !== ev._id));
      setViewEvent(null);
    } catch {
      // silently handle
    }
  }

  /* ── File upload ──────────────────────────────────────────────────── */

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      // Upload via the project media endpoint so the file is tracked in the
      // Media Library and appears under the Media tab for this project.
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post(
        `/projects/${projectId}/media`,
        body,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const attachment: CalEventAttachment = {
        name: data.name ?? file.name,
        url: data.url,
        mimeType: data.mimeType ?? file.type,
        fileType: fileTypeFromMime(data.mimeType ?? file.type),
      };
      setField('attachments', [...form.attachments, attachment]);
    } catch {
      // silently handle
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeAttachment(idx: number) {
    setField('attachments', form.attachments.filter((_, i) => i !== idx));
  }

  /* ── Media picker ─────────────────────────────────────────────────── */

  async function openMediaPicker() {
    setMediaPickerOpen(true);
    setSelectedMediaIds(new Set());
    if (mediaItems.length > 0) return;
    setMediaLoading(true);
    try {
      const { data } = await api.get<MediaItem[]>(`/projects/${projectId}/media`);
      setMediaItems(data);
    } catch {
      // silently handle
    } finally {
      setMediaLoading(false);
    }
  }

  function toggleMediaSelect(id: string) {
    setSelectedMediaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelectedMedia() {
    const toAdd: CalEventAttachment[] = mediaItems
      .filter(m => selectedMediaIds.has(m._id))
      .map(m => ({
        name: m.name,
        url: m.url,
        mimeType: m.mimeType,
        fileType: m.fileType === 'archive' ? 'other' : (m.fileType as CalEventAttachment['fileType']),
      }));
    setField('attachments', [...form.attachments, ...toAdd]);
    setMediaPickerOpen(false);
  }

  /* ── Permission check ─────────────────────────────────────────────── */

  function canModify(ev: CalendarEvent): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'manager') return true;
    return ev.createdBy?.id === user.id;
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div className={styles.root}>
      {/* ── Left: Calendar Pane ─────────────────────────────────────── */}
      <div className={styles.calendarPane}>
        {/* Header */}
        <div className={styles.calHeader}>
          <span className={styles.monthTitle}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={prevMonth} aria-label="Previous month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className={styles.todayBtn} onClick={goToday}>Today</button>
            <button className={styles.navBtn} onClick={nextMonth} aria-label="Next month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className={styles.weekdayRow}>
          {WEEKDAYS.map(d => (
            <div key={d} className={styles.weekdayCell}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className={styles.loadingRow}><Spinner size="md" /></div>
        ) : (
          <div className={styles.grid}>
            {cells.map((cell, idx) => {
              const cellStr = toDateStr(
                cell.date.getFullYear(),
                cell.date.getMonth(),
                cell.date.getDate()
              );
              const dayEvents = eventsByDate[cellStr] ?? [];
              const isToday = cellStr === todayStr;
              const isSelected = cellStr === selectedDate;
              const isOtherMonth = !cell.isCurrentMonth;

              return (
                <div
                  key={idx}
                  className={cn(
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && styles.dayCellToday,
                    isOtherMonth && styles.dayCellOtherMonth
                  )}
                  onClick={() => setSelectedDate(cellStr)}
                >
                  <span className={cn(styles.dayNumber, isToday && styles.dayNumberToday)}>
                    {cell.date.getDate()}
                  </span>
                  <div className={styles.pillList}>
                    {dayEvents.slice(0, 3).map(ev => (
                      <button
                        key={ev._id}
                        className={styles.eventPill}
                        style={{ backgroundColor: ev.color + '22', borderLeft: `3px solid ${ev.color}` }}
                        title={ev.title}
                        onClick={e => { e.stopPropagation(); setViewEvent(ev); }}
                      >
                        <span className={styles.pillDot} style={{ backgroundColor: ev.color }} />
                        <span className={styles.pillTitle}>{ev.title}</span>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        className={styles.moreLink}
                        onClick={e => { e.stopPropagation(); setSelectedDate(cellStr); }}
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: Detail Pane ──────────────────────────────────────── */}
      <div className={styles.detailPane}>
        <div className={styles.detailHeader}>
          <span className={styles.detailDateTitle}>
            {selectedDate ? formatDayHeading(selectedDate) : 'Select a day'}
          </span>
          <Button size="sm" onClick={openCreateModal}>
            + Add Event
          </Button>
        </div>

        {selectedEvents.length === 0 ? (
          <p className={styles.emptyDetail}>No events for this day.</p>
        ) : (
          <div className={styles.eventList}>
            {selectedEvents.map(ev => (
              <button
                key={ev._id}
                className={styles.eventRow}
                onClick={() => setViewEvent(ev)}
              >
                <span className={styles.eventRowDot} style={{ backgroundColor: ev.color }} />
                <span className={styles.eventRowTime}>
                  {ev.allDay ? 'All day' : ev.startTime || ''}
                </span>
                <span className={styles.eventRowTitle}>{ev.title}</span>
                <span className={cn(styles.typeBadge, styles[`type_${ev.type}`])}>
                  {ev.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingEvent ? 'Edit Event' : 'New Event'}
        size="lg"
      >
        {/* Tab bar */}
        <div className={styles.formTabs}>
          {(['details', 'note', 'attachments'] as ModalTab[]).map(tab => (
            <button
              key={tab}
              className={cn(styles.formTab, modalTab === tab && styles.formTabActive)}
              onClick={() => setModalTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Details tab ─────────────────────────────────────────── */}
        {modalTab === 'details' && (
          <div className={styles.tabContent}>
            {/* Title */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Title <span className={styles.required}>*</span></label>
              <input
                className={styles.input}
                type="text"
                placeholder="Event title"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
              />
            </div>

            {/* Type + Recurrence row */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Type</label>
                <select
                  className={styles.select}
                  value={form.type}
                  onChange={e => setField('type', e.target.value as CalendarEvent['type'])}
                >
                  <option value="event">Event</option>
                  <option value="meeting">Meeting</option>
                  <option value="reminder">Reminder</option>
                  <option value="deadline">Deadline</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Recurrence</label>
                <select
                  className={styles.select}
                  value={form.recurrence}
                  onChange={e => setField('recurrence', e.target.value as CalendarEvent['recurrence'])}
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Color */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Color</label>
              <div className={styles.colorRow}>
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={cn(styles.colorSwatch, form.color === c && styles.colorSwatchActive)}
                    style={{ backgroundColor: c }}
                    onClick={() => setField('color', c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            {/* Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Date</label>
              <input
                className={styles.input}
                type="date"
                value={form.date}
                onChange={e => setField('date', e.target.value)}
              />
            </div>

            {/* All Day toggle */}
            <div className={styles.formGroupInline}>
              <input
                id="allDay"
                type="checkbox"
                className={styles.checkbox}
                checked={form.allDay}
                onChange={e => setField('allDay', e.target.checked)}
              />
              <label htmlFor="allDay" className={styles.checkboxLabel}>All Day</label>
            </div>

            {/* Time fields */}
            {!form.allDay && (
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Start Time</label>
                  <input
                    className={styles.input}
                    type="time"
                    value={form.startTime}
                    onChange={e => setField('startTime', e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>End Time</label>
                  <input
                    className={styles.input}
                    type="time"
                    value={form.endTime}
                    onChange={e => setField('endTime', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Location */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Location</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Add location"
                value={form.location}
                onChange={e => setField('location', e.target.value)}
              />
            </div>

            {/* Description */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="Add a description"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Note tab ────────────────────────────────────────────── */}
        {modalTab === 'note' && (
          <div className={styles.tabContent}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Note</label>
              <textarea
                className={styles.textareaTall}
                rows={10}
                placeholder="Add a longer note, agenda, or details…"
                value={form.note}
                onChange={e => setField('note', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Attachments tab ─────────────────────────────────────── */}
        {modalTab === 'attachments' && (
          <div className={styles.tabContent}>
            <div className={styles.attachActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                loading={uploadingFile}
                disabled={uploadingFile}
              >
                Upload File
              </Button>
              <Button variant="secondary" size="sm" onClick={openMediaPicker}>
                Pick from Media Library
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>

            {form.attachments.length === 0 ? (
              <p className={styles.emptyAttach}>No attachments yet.</p>
            ) : (
              <ul className={styles.attachList}>
                {form.attachments.map((att, idx) => (
                  <li key={idx} className={styles.attachItem}>
                    {att.fileType === 'image' ? (
                      <img
                        src={att.url.startsWith('http') ? att.url : `${STATIC_BASE}${att.url}`}
                        alt={att.name}
                        className={styles.attachThumb}
                      />
                    ) : (
                      <span className={styles.attachIcon}>
                        <AttachmentFileIcon fileType={att.fileType} />
                      </span>
                    )}
                    <span className={styles.attachName}>{att.name}</span>
                    <button
                      className={styles.attachRemove}
                      onClick={() => removeAttachment(idx)}
                      aria-label="Remove attachment"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Modal footer */}
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={closeModal}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!form.title.trim() || saving}>
            {editingEvent ? 'Save Changes' : 'Create Event'}
          </Button>
        </div>
      </Modal>

      {/* ── Event Detail Modal ──────────────────────────────────────── */}
      {viewEvent && (
        <EventDetailModal
          event={viewEvent}
          canModify={canModify(viewEvent)}
          onClose={() => setViewEvent(null)}
          onEdit={() => openEditModal(viewEvent)}
          onDelete={() => handleDelete(viewEvent)}
        />
      )}

      {/* ── Media Picker Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        title="Pick from Media Library"
        size="lg"
      >
        {mediaLoading ? (
          <div className={styles.loadingRow}><Spinner /></div>
        ) : mediaItems.length === 0 ? (
          <p className={styles.emptyDetail}>No media found.</p>
        ) : (
          <div className={styles.mediaPicker}>
            {mediaItems.map(m => {
              const isImg = m.fileType === 'image';
              const imgSrc = m.url.startsWith('http') ? m.url : `${STATIC_BASE}${m.url}`;
              const selected = selectedMediaIds.has(m._id);
              return (
                <button
                  key={m._id}
                  className={cn(styles.mediaPickerItem, selected && styles.mediaPickerItemSelected)}
                  onClick={() => toggleMediaSelect(m._id)}
                  title={m.name}
                >
                  {isImg ? (
                    <img src={imgSrc} alt={m.name} className={styles.mediaThumb} />
                  ) : (
                    <span className={styles.mediaFileIcon}>
                      <AttachmentFileIcon fileType={m.fileType === 'archive' ? 'other' : (m.fileType as CalEventAttachment['fileType'])} />
                    </span>
                  )}
                  <span className={styles.mediaName}>{m.name}</span>
                  {selected && (
                    <span className={styles.mediaCheck}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={() => setMediaPickerOpen(false)}>Cancel</Button>
          <Button onClick={addSelectedMedia} disabled={selectedMediaIds.size === 0}>
            Add Selected ({selectedMediaIds.size})
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ── EventDetailModal sub-component ────────────────────────────────── */

interface EventDetailModalProps {
  event: CalendarEvent;
  canModify: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EventDetailModal({ event, canModify, onClose, onEdit, onDelete }: EventDetailModalProps) {
  const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

  const dateStr = new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeLabel = event.allDay
    ? 'All day'
    : [event.startTime, event.endTime].filter(Boolean).join(' – ');

  // Viewer state for attachment lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <Modal isOpen onClose={onClose} title=" " size="md">
      {/* Colour band + title */}
      <div className={styles.viewBand} style={{ background: event.color }}>
        <span className={styles.viewBandTitle}>{event.title}</span>
        <span className={cn(styles.typeBadge, styles[`type_${event.type}`])} style={{ flexShrink: 0 }}>
          {event.type}
        </span>
      </div>

      <div className={styles.viewBody}>
        {/* Date / time */}
        <div className={styles.viewRow}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.viewIcon}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>{dateStr}</span>
          {timeLabel && <span className={styles.viewTimePill}>{timeLabel}</span>}
        </div>

        {/* Location */}
        {event.location && (
          <div className={styles.viewRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.viewIcon}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{event.location}</span>
          </div>
        )}

        {/* Recurrence */}
        {event.recurrence !== 'none' && (
          <div className={styles.viewRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.viewIcon}>
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
            <span style={{ textTransform: 'capitalize' }}>{event.recurrence}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className={styles.viewSection}>
            <p className={styles.viewSectionLabel}>Description</p>
            <p className={styles.viewText}>{event.description}</p>
          </div>
        )}

        {/* Note */}
        {event.note && (
          <div className={styles.viewSection}>
            <p className={styles.viewSectionLabel}>Note</p>
            <pre className={styles.viewNote}>{event.note}</pre>
          </div>
        )}

        {/* Attachments */}
        {event.attachments && event.attachments.length > 0 && (
          <div className={styles.viewSection}>
            <p className={styles.viewSectionLabel}>Attachments ({event.attachments.length})</p>
            <div className={styles.viewAttachGrid}>
              {event.attachments.map((att, i) => {
                const src = att.url.startsWith('http') ? att.url : `${BASE}${att.url}`;
                if (att.fileType === 'image') {
                  return (
                    <button key={i} className={styles.viewAttachImg} onClick={() => setLightbox(src)}>
                      <img src={src} alt={att.name} />
                    </button>
                  );
                }
                if (att.fileType === 'video') {
                  return (
                    <div key={i} className={styles.viewAttachVideo}>
                      <video src={src} controls className={styles.viewVideo} />
                      <span className={styles.viewAttachName}>{att.name}</span>
                    </div>
                  );
                }
                return (
                  <a key={i} href={src} target="_blank" rel="noreferrer" download={att.name} className={styles.viewAttachFile}>
                    <AttachmentFileIcon fileType={att.fileType} />
                    <span className={styles.viewAttachName}>{att.name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Created by */}
        {event.createdBy && (
          <p className={styles.viewCreatedBy}>Created by {event.createdBy.name}</p>
        )}
      </div>

      {/* Footer actions */}
      <div className={styles.viewFooter}>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        {canModify && (
          <div className={styles.viewFooterRight}>
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Image lightbox */}
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Preview" className={styles.lightboxImg} />
          <button className={styles.lightboxClose} onClick={() => setLightbox(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
    </Modal>
  );
}
