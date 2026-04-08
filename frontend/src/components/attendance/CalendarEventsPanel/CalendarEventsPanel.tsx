'use client';

import { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Avatar from '@/components/ui/Avatar/Avatar';
import type { CalendarEvent, User } from '@/types';
import styles from './CalendarEventsPanel.module.css';

interface Props {
  selectedDay: Date | null;
  events: CalendarEvent[];
  currentUser: { id: string; role: string };
  members?: User[];
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<CalendarEvent | null>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<CalendarEvent | null>;
  onDelete: (id: string) => Promise<boolean>;
}

const EVENT_COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Yellow', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Teal', value: '#14b8a6' },
];

const TYPE_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  reminder: 'Reminder',
  event: 'Event',
  deadline: 'Deadline',
};

const TYPE_ICONS: Record<string, string> = {
  meeting: '👥',
  reminder: '🔔',
  event: '📅',
  deadline: '⚠️',
};

const emptyForm = {
  title: '',
  description: '',
  type: 'event' as CalendarEvent['type'],
  startTime: '',
  endTime: '',
  allDay: false,
  color: '#6366f1',
  location: '',
  recurrence: 'none' as CalendarEvent['recurrence'],
  owner: '',
  invitees: [] as string[],
};

export default function CalendarEventsPanel({
  selectedDay,
  events,
  currentUser,
  members = [],
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';

  const dayEvents = selectedDay
    ? events.filter((e) => isSameDay(new Date(e.date), selectedDay))
    : [];

  const openCreate = () => {
    setEditingEvent(null);
    setForm({ ...emptyForm, owner: currentUser.id });
    setShowForm(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description || '',
      type: ev.type,
      startTime: ev.startTime || '',
      endTime: ev.endTime || '',
      allDay: ev.allDay,
      color: ev.color,
      location: ev.location || '',
      recurrence: ev.recurrence,
      owner: typeof ev.owner === 'object' ? ev.owner.id : ev.owner,
      invitees: ev.invitees.map((u) => (typeof u === 'object' ? u.id : u)),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !selectedDay) return;
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description,
      type: form.type,
      date: format(selectedDay, 'yyyy-MM-dd'),
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      allDay: form.allDay,
      color: form.color,
      location: form.location,
      recurrence: form.recurrence,
      owner: form.owner || currentUser.id,
      invitees: form.invitees,
    };

    if (editingEvent) {
      await onUpdate(editingEvent._id, payload);
    } else {
      await onCreate(payload);
    }

    setSaving(false);
    setShowForm(false);
    setEditingEvent(null);
    setForm({ ...emptyForm, owner: currentUser.id });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
  };

  const canEdit = (ev: CalendarEvent) => {
    if (isAdminOrManager) return true;
    const ownerId = typeof ev.owner === 'object' ? ev.owner.id : ev.owner;
    const creatorId = typeof ev.createdBy === 'object' ? ev.createdBy.id : ev.createdBy;
    return ownerId === currentUser.id || creatorId === currentUser.id;
  };

  if (!selectedDay) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.dateLabel}>{format(selectedDay, 'EEEE, MMMM d')}</span>
          <span className={styles.eventCount}>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
        </div>
        <div className={styles.panelActions}>
          <Button size="sm" onClick={openCreate}>+ Add</Button>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
      </div>

      {dayEvents.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📅</span>
          <p>No events for this day.</p>
          <Button size="sm" variant="secondary" onClick={openCreate}>Create one</Button>
        </div>
      ) : (
        <div className={styles.eventList}>
          {dayEvents.map((ev) => (
            <div key={ev._id} className={styles.eventCard} style={{ borderLeftColor: ev.color }}>
              <div className={styles.eventTop}>
                <div className={styles.eventTitleRow}>
                  <span className={styles.eventIcon}>{TYPE_ICONS[ev.type]}</span>
                  <span className={styles.eventTitle}>{ev.title}</span>
                  <span className={styles.eventType}>{TYPE_LABELS[ev.type]}</span>
                </div>
                {canEdit(ev) && (
                  <div className={styles.eventBtns}>
                    <button className={styles.editBtn} onClick={() => openEdit(ev)}>Edit</button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(ev._id)}
                      disabled={deleting === ev._id}
                    >
                      {deleting === ev._id ? '...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>

              {(ev.startTime || ev.allDay) && (
                <div className={styles.eventTime}>
                  {ev.allDay ? 'All day' : `${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ''}`}
                </div>
              )}
              {ev.location && <div className={styles.eventLocation}>📍 {ev.location}</div>}
              {ev.description && <p className={styles.eventDesc}>{ev.description}</p>}
              {ev.invitees.length > 0 && (
                <div className={styles.invitees}>
                  {ev.invitees.slice(0, 5).map((u) => (
                    <Avatar key={typeof u === 'object' ? u.id : u} name={typeof u === 'object' ? u.name : ''} size="sm" />
                  ))}
                  {ev.invitees.length > 5 && <span className={styles.moreInvitees}>+{ev.invitees.length - 5}</span>}
                </div>
              )}
              {ev.recurrence !== 'none' && (
                <div className={styles.recurrence}>Repeats {ev.recurrence}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingEvent(null); }}
        title={editingEvent ? 'Edit Event' : 'New Event'}
        size="md"
      >
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Event title"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEvent['type'] })}>
                <option value="event">Event</option>
                <option value="meeting">Meeting</option>
                <option value="reminder">Reminder</option>
                <option value="deadline">Deadline</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Color</label>
              <div className={styles.colorRow}>
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`${styles.colorBtn} ${form.color === c.value ? styles.colorSelected : ''}`}
                    style={{ background: c.value }}
                    title={c.label}
                    onClick={() => setForm({ ...form, color: c.value })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                disabled={form.allDay}
              />
            </div>
            <div className={styles.field}>
              <label>End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                disabled={form.allDay}
              />
            </div>
          </div>

          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="allDay"
              checked={form.allDay}
              onChange={(e) => setForm({ ...form, allDay: e.target.checked, startTime: '', endTime: '' })}
            />
            <label htmlFor="allDay">All day</label>
          </div>

          <div className={styles.field}>
            <label>Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Optional location"
            />
          </div>

          <div className={styles.field}>
            <label>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Recurrence</label>
              <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as CalendarEvent['recurrence'] })}>
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {isAdminOrManager && members.length > 0 && (
              <div className={styles.field}>
                <label>Owner</label>
                <select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
                  <option value={currentUser.id}>Myself</option>
                  {members.filter((m) => m.id !== currentUser.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {members.length > 0 && (
            <div className={styles.field}>
              <label>Invite Members</label>
              <select
                multiple
                size={4}
                value={form.invitees}
                onChange={(e) => setForm({ ...form, invitees: Array.from(e.target.selectedOptions, (o) => o.value) })}
              >
                {members.filter((m) => m.id !== form.owner).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <span className={styles.hint}>Hold Ctrl/Cmd to select multiple</span>
            </div>
          )}

          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingEvent(null); }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.title.trim()}>
              {editingEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
