'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import TaskTimer from '@/components/tasks/TaskTimer';
import { formatDate, timeAgo } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuthStore } from '@/store/authStore';
import { uploadFile } from '@/lib/api';
import type { Task, Comment, User, Attachment } from '@/types';
import styles from './TaskModal.module.css';
import { Check, CornerUpRight, ArrowRight, Clock, Trash2 } from 'lucide-react';

type Tab = 'details' | 'notes' | 'links' | 'files' | 'comments' | 'timeline';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onSaved?: () => void;
  members: User[];
  projects?: { _id: string; title: string }[];
  patchTimer?: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
}

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

const statusVariant = {
  backlog: 'default' as const,
  todo: 'default' as const,
  in_progress: 'primary' as const,
  in_review: 'warning' as const,
  done: 'success' as const,
};

// Derive base URL once (env var never changes at runtime)
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

/** Extract string ID from a User-like object (handles both `id` and `_id`) */
function uid(u: User | any): string {
  return (u?.id || u?._id)?.toString() ?? '';
}

export default function TaskModal({ task, isOpen, onClose, onUpdate, onDelete, onSaved, members, projects, patchTimer }: TaskModalProps) {
  const { updateTask, addComment, delegateTask } = useTasks();
  const { departments } = useDepartments();
  const currentUser = useAuthStore((s) => s.user);
  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isReporter = task ? uid(task.reporter) === uid(currentUser) : false;
  const canEdit = isAdminOrManager || isReporter;
  const canDelete = isAdminOrManager || isReporter;

  // Departments where current user is a head
  const myHeadDepts = useMemo(
    () => departments.filter((d) =>
      d.heads.some((h) => uid(h) === uid(currentUser))
    ),
    [departments, currentUser]
  );

  // Members current user can delegate to
  const delegatableMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const d of myHeadDepts) {
      for (const m of [...d.members, ...d.heads]) {
        const id = uid(m);
        if (id && id !== uid(currentUser) && !seen.has(id)) {
          seen.add(id);
          result.push({ id, name: m.name });
        }
      }
    }
    return result;
  }, [myHeadDepts, currentUser]);

  const [tab, setTab] = useState<Tab>('details');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Inline edit
  const [editTitle, setEditTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editEstHours, setEditEstHours] = useState('');
  const [editProject, setEditProject] = useState('');

  // Links
  const [newLink, setNewLink] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);

  // Files
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newAttachName, setNewAttachName] = useState('');
  const [newAttachUrl, setNewAttachUrl] = useState('');
  const [savingAttach, setSavingAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assignee editing
  const [editingAssignees, setEditingAssignees] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [savingAssignees, setSavingAssignees] = useState(false);

  // Delegation
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateTo, setDelegateTo] = useState('');
  const [delegateNote, setDelegateNote] = useState('');
  const [delegating, setDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState('');

  // Mentions
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // All hooks before any early return ↑

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description || '');
      setEditNotes(task.notes || '');
      setEditStatus(task.status);
      setEditPriority(task.priority);
      setEditDue(task.dueDate ? task.dueDate.split('T')[0] : '');
      setEditDueTime(task.dueTime || '');
      setComments(task.comments || []);
      setLinks(task.links || []);
      setAttachments(task.attachments || []);
      setAssigneeIds(task.assignees.filter(Boolean).map((a) => uid(a)));
      setEditEstHours(task.estimatedHours != null ? String(task.estimatedHours) : '');
      setEditProject(
        task.project
          ? typeof task.project === 'object'
            ? (task.project as any)._id
            : task.project
          : ''
      );
      setTab('details');
      setEditingTitle(false);
      setEditingDesc(false);
      setEditingAssignees(false);
      setShowDelegate(false);
      setDelegateTo('');
      setDelegateNote('');
      setDelegateError('');
    }
  }, [task]);

  if (!task) return null;

  // Dirty check — any main field changed from the task prop
  const taskProjectId = task.project
    ? typeof task.project === 'object'
      ? (task.project as any)._id
      : task.project
    : '';

  const isDirty =
    editTitle.trim() !== task.title ||
    editDesc !== (task.description || '') ||
    editStatus !== task.status ||
    editPriority !== task.priority ||
    editDue !== (task.dueDate ? task.dueDate.split('T')[0] : '') ||
    editDueTime !== (task.dueTime || '') ||
    editNotes !== (task.notes || '') ||
    editProject !== taskProjectId;

  // ── Helpers ──────────────────────────────────────────────────────
  const save = async (patch: Partial<Task>) => {
    setSaving(true);
    const updated = await updateTask(task._id, patch);
    if (updated) onUpdate(updated);
    setSaving(false);
    return updated;
  };

  // Main save — commits all editable fields, closes modal, fires onSaved
  const handleSaveAll = async () => {
    const updated = await save({
      title: editTitle.trim() || task.title,
      description: editDesc,
      status: editStatus as Task['status'],
      priority: editPriority as Task['priority'],
      dueDate: editDue || undefined,
      dueTime: editDueTime || undefined,
      notes: editNotes,
      ...(editProject ? { project: editProject } : { project: null }),
    } as Partial<Task>);
    if (updated) {
      onClose();
      onSaved?.();
    }
  };

  const handleTitleSave = () => {
    if (!editTitle.trim()) setEditTitle(task.title);
    setEditingTitle(false);
  };

  const handleDescSave = () => {
    setEditingDesc(false);
  };

  const handleAssigneesSave = async () => {
    setSavingAssignees(true);
    await save({ assignees: assigneeIds } as unknown as Partial<Task>);
    setSavingAssignees(false);
    setEditingAssignees(false);
  };

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => (prev.includes(id) ? [] : [id]));
  };

  const handleDelegate = async () => {
    if (!task || !delegateTo) return;
    setDelegating(true);
    setDelegateError('');
    const result = await delegateTask(task._id, delegateTo, delegateNote);
    if (result) {
      onUpdate(result);
      setShowDelegate(false);
      setDelegateTo('');
      setDelegateNote('');
    } else {
      setDelegateError('Could not delegate. Check you have permission.');
    }
    setDelegating(false);
  };

  // ── Links ─────────────────────────────────────────────────────────
  const addLink = async () => {
    const url = newLink.trim();
    if (!url) return;
    const updated = [...links, url];
    setSavingLinks(true);
    const result = await updateTask(task._id, { links: updated } as Partial<Task>);
    if (result) { setLinks(result.links || []); onUpdate(result); }
    setSavingLinks(false);
    setNewLink('');
  };

  const removeLink = async (idx: number) => {
    const updated = links.filter((_, i) => i !== idx);
    const result = await updateTask(task._id, { links: updated } as Partial<Task>);
    if (result) { setLinks(result.links || []); onUpdate(result); }
  };

  // ── Attachments (URL) ─────────────────────────────────────────────
  const addAttachment = async () => {
    if (!newAttachUrl.trim()) return;
    const ext = newAttachUrl.split('.').pop()?.toLowerCase() || '';
    const type: Attachment['type'] = ['jpg','jpeg','png','gif','webp','svg'].includes(ext) ? 'image' : 'file';
    const newA: Attachment = {
      name: newAttachName.trim() || newAttachUrl,
      url: newAttachUrl.trim(),
      type,
      uploadedAt: new Date().toISOString(),
    };
    const updated = [...attachments, newA];
    setSavingAttach(true);
    const result = await updateTask(task._id, { attachments: updated } as Partial<Task>);
    if (result) { setAttachments(result.attachments || []); onUpdate(result); }
    setSavingAttach(false);
    setNewAttachName('');
    setNewAttachUrl('');
  };

  const removeAttachment = async (idx: number) => {
    const updated = attachments.filter((_, i) => i !== idx);
    const result = await updateTask(task._id, { attachments: updated } as Partial<Task>);
    if (result) { setAttachments(result.attachments || []); onUpdate(result); }
  };

  // ── File upload ───────────────────────────────────────────────────
  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setUploadError('');
    const uploaded: Attachment[] = [];
    try {
      for (const file of list) {
        const data = await uploadFile(file);
        uploaded.push({ name: data.name, url: data.url, type: data.type, uploadedAt: new Date().toISOString() });
      }
      const next = [...attachments, ...uploaded];
      const result = await updateTask(task._id, { attachments: next } as Partial<Task>);
      if (result) { setAttachments(result.attachments || []); onUpdate(result); }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Comments ──────────────────────────────────────────────────────
  const handleComment = async () => {
    if (!newComment.trim()) return;
    const mentionRegex = /@(\w+)/g;
    const mentionNames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) mentionNames.push(match[1]);
    const mentionIds = members
      .filter((m) => mentionNames.some((n) => m.name.toLowerCase().includes(n.toLowerCase())))
      .map((m) => m.id);
    const comment = await addComment(task._id, newComment, mentionIds);
    if (comment) { setComments((prev) => [...prev, comment]); setNewComment(''); }
  };

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    const lastAt = value.lastIndexOf('@');
    if (lastAt !== -1 && !value.substring(lastAt).includes(' ')) {
      setMentionSearch(value.substring(lastAt + 1));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const lastAt = newComment.lastIndexOf('@');
    setNewComment(newComment.substring(0, lastAt) + '@' + name + ' ');
    setShowMentions(false);
  };

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // ── Timer ─────────────────────────────────────────────────────────
  const handleTimerAct = patchTimer
    ? async (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
        const updated = await patchTimer(task._id, action);
        if (updated) onUpdate(updated);
      }
    : undefined;

  const tabCount = (t: Tab) => {
    if (t === 'links') return links.length || undefined;
    if (t === 'files') return attachments.length || undefined;
    if (t === 'comments') return comments.length || undefined;
    if (t === 'timeline') return task.timerEvents.length || undefined;
    return undefined;
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'notes', label: 'Notes' },
    { key: 'links', label: 'Links' },
    { key: 'files', label: 'Files' },
    { key: 'comments', label: 'Comments' },
    { key: 'timeline', label: 'Timeline' },
  ];

  // ── Timeline helpers ──────────────────────────────────────────────
  const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
    start:  { label: 'Started',   color: '#10b981', bg: '#d1fae5' },
    resume: { label: 'Resumed',   color: '#0ea5e9', bg: '#e0f2fe' },
    pause:  { label: 'Paused',    color: '#f59e0b', bg: '#fef3c7' },
    hold:   { label: 'On Hold',   color: '#f97316', bg: '#ffedd5' },
    finish: { label: 'Finished',  color: '#8b5cf6', bg: '#ede9fe' },
  };

  function fmtDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  }

  function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // Build enriched timeline entries with duration annotations
  const timelineEntries = task.timerEvents.map((ev, i) => {
    const prev = i > 0 ? task.timerEvents[i - 1] : null;
    const durationMs = prev
      ? new Date(ev.timestamp).getTime() - new Date(prev.timestamp).getTime()
      : null;

    // Label the duration based on what happened in the segment
    let durationLabel: string | null = null;
    if (durationMs !== null && durationMs >= 0) {
      const prevAction = prev!.action;
      if (prevAction === 'start' || prevAction === 'resume') {
        durationLabel = `Worked for ${fmtDuration(durationMs)}`;
      } else if (prevAction === 'pause' || prevAction === 'hold') {
        durationLabel = `Inactive for ${fmtDuration(durationMs)}`;
      }
    }
    return { ...ev, durationLabel };
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className={styles.root}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            {editingTitle && canEdit ? (
              <input
                ref={titleInputRef}
                className={styles.titleInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                autoFocus
              />
            ) : (
              <h2
                className={styles.titleDisplay}
                onClick={() => canEdit && setEditingTitle(true)}
                title={canEdit ? 'Click to edit' : undefined}
                style={canEdit ? undefined : { cursor: 'default' }}
              >
                {task.title}
                {canEdit && <span className={styles.editHint}>✎</span>}
              </h2>
            )}
            <div className={styles.headerBadges}>
              <Badge variant={statusVariant[task.status]} size="sm">{task.status.replace(/_/g, ' ')}</Badge>
              <Badge variant={priorityVariant[task.priority]} size="sm">{task.priority}</Badge>
            </div>
          </div>

          <div className={styles.tabs}>
            {TABS.map(({ key, label }) => {
              const count = tabCount(key);
              return (
                <button
                  key={key}
                  className={`${styles.tabBtn} ${tab === key ? styles.tabActive : ''}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                  {count !== undefined && <span className={styles.tabCount}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className={styles.body}>
          <div className={styles.main}>

            {/* DETAILS */}
            {tab === 'details' && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Description</span>
                  {canEdit && !editingDesc && (
                    <button className={styles.inlineEditBtn} onClick={() => setEditingDesc(true)}>Edit</button>
                  )}
                </div>
                {editingDesc && canEdit ? (
                  <div className={styles.editBlock}>
                    <textarea
                      className={styles.descTextarea}
                      rows={5}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Add a description..."
                      autoFocus
                    />
                    <div className={styles.editActions}>
                      <Button size="sm" onClick={handleDescSave}>Done</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditDesc(task.description || ''); setEditingDesc(false); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={styles.descText}
                    onClick={() => canEdit && setEditingDesc(true)}
                    style={canEdit ? undefined : { cursor: 'default' }}
                  >
                    {task.description || <span className={styles.placeholder}>{canEdit ? 'Click to add description…' : 'No description.'}</span>}
                  </p>
                )}

                {task.tags.length > 0 && (
                  <div className={styles.tags}>
                    {task.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                )}

                <div className={styles.sectionHeader} style={{ marginTop: '1rem' }}>
                  <span className={styles.sectionLabel}>Assignees</span>
                  {canEdit && !editingAssignees && (
                    <button
                      className={styles.inlineEditBtn}
                      onClick={() => setEditingAssignees(true)}
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingAssignees ? (
                  <div className={styles.assigneeEditor}>
                    <div className={styles.assigneePickerGrid}>
                      {members.map((m) => {
                        const id = uid(m);
                        const selected = assigneeIds.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`${styles.assigneePickerChip} ${selected ? styles.assigneePickerChipActive : ''}`}
                            onClick={() => toggleAssignee(id)}
                          >
                            <Avatar name={m.name || '?'} size="sm" />
                            <span className={styles.assigneePickerName}>{m.name}</span>
                            {selected && (
                              <Check size={11} strokeWidth={3} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className={styles.editActions}>
                      <Button size="sm" onClick={handleAssigneesSave} loading={savingAssignees}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setAssigneeIds(task.assignees.filter(Boolean).map((a) => uid(a)));
                        setEditingAssignees(false);
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.assignees}>
                    {task.assignees.filter(Boolean).length === 0
                      ? <span className={styles.placeholder}>No assignees</span>
                      : task.assignees.filter(Boolean).map((a) => (
                          <div key={(a as any)._id?.toString() || a.id || a.email} className={styles.person}>
                            <Avatar name={a.name || '?'} size="sm" />
                            <span>{a.name}</span>
                          </div>
                        ))
                    }

                    {/* Delegate button — visible to assignees who are dept heads */}
                    {(() => {
                      const isAssignee = task.assignees.filter(Boolean).some(
                        (a) => uid(a) === uid(currentUser)
                      );
                      const canDelegate = isAssignee && (myHeadDepts.length > 0 || isAdminOrManager);
                      if (!canDelegate) return null;
                      return (
                        <button
                          className={styles.delegateBtn}
                          onClick={() => setShowDelegate((v) => !v)}
                        >
                          <CornerUpRight size={12} strokeWidth={2.5} />
                          Delegate
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* Delegate panel */}
                {showDelegate && (
                  <div className={styles.delegatePanel}>
                    <p className={styles.delegatePanelTitle}>Delegate to</p>
                    <select
                      className={styles.delegateSelect}
                      value={delegateTo}
                      onChange={(e) => setDelegateTo(e.target.value)}
                    >
                      <option value="">Select a team member…</option>
                      {delegatableMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <textarea
                      className={styles.delegateNote}
                      rows={2}
                      placeholder="Note (optional)"
                      value={delegateNote}
                      onChange={(e) => setDelegateNote(e.target.value)}
                    />
                    {delegateError && (
                      <p className={styles.delegateError}>{delegateError}</p>
                    )}
                    <div className={styles.delegateActions}>
                      <Button variant="ghost" size="sm" onClick={() => { setShowDelegate(false); setDelegateError(''); }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleDelegate} loading={delegating} disabled={!delegateTo}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}

                {/* Delegation history */}
                {(task.delegations ?? []).length > 0 && (
                  <div className={styles.delegationHistory}>
                    <span className={styles.sectionLabel} style={{ marginTop: '0.75rem', display: 'block' }}>Delegation history</span>
                    {task.delegations.map((d) => (
                      <div key={d._id} className={styles.delegationEntry}>
                        <span className={styles.delegationLine}>
                          <strong>{d.delegatedBy?.name}</strong>
                          <ArrowRight size={10} strokeWidth={2.5} style={{ margin: '0 4px', flexShrink: 0 }} />
                          <strong>{d.delegatedTo?.name}</strong>
                        </span>
                        {d.note && <span className={styles.delegationNote}>"{d.note}"</span>}
                        <span className={styles.delegationTime}>{timeAgo(d.delegatedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NOTES */}
            {tab === 'notes' && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Notes</span>
                </div>
                <textarea
                  className={styles.notesTextarea}
                  rows={14}
                  value={editNotes}
                  onChange={(e) => canEdit && setEditNotes(e.target.value)}
                  placeholder={canEdit ? 'Write notes, checklists, or any context for this task…' : 'No notes.'}
                  readOnly={!canEdit}
                  style={canEdit ? undefined : { cursor: 'default', opacity: 0.7 }}
                />
              </div>
            )}

            {/* LINKS */}
            {tab === 'links' && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Links</div>
                <div className={styles.addRow}>
                  <input
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    placeholder="https://..."
                    onKeyDown={(e) => e.key === 'Enter' && addLink()}
                  />
                  <Button size="sm" onClick={addLink} loading={savingLinks}>Add</Button>
                </div>
                {links.length === 0 ? (
                  <p className={styles.placeholder}>No links added yet.</p>
                ) : (
                  <div className={styles.linkList}>
                    {links.map((url, i) => (
                      <div key={i} className={styles.linkItem}>
                        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkUrl}>
                          <span className={styles.linkIcon}>🔗</span>
                          <span className={styles.linkText}>{url}</span>
                        </a>
                        <button className={styles.removeBtn} onClick={() => removeLink(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FILES */}
            {tab === 'files' && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Files & Attachments</div>

                <div
                  className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''} ${uploading ? styles.dropZoneUploading : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className={styles.fileInputHidden}
                    onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip"
                  />
                  {uploading ? (
                    <span className={styles.dropZoneText}>Uploading…</span>
                  ) : (
                    <>
                      <span className={styles.dropZoneIcon}>📁</span>
                      <span className={styles.dropZoneText}>Drop files here or <u>browse</u></span>
                      <span className={styles.dropZoneSub}>Images, PDFs, Docs, Spreadsheets — max 1 GB each</span>
                    </>
                  )}
                </div>

                {uploadError && <p className={styles.uploadError}>{uploadError}</p>}

                <details className={styles.urlFallback}>
                  <summary>Or attach by URL</summary>
                  <div className={styles.addAttach}>
                    <input value={newAttachName} onChange={(e) => setNewAttachName(e.target.value)} placeholder="Display name (optional)" />
                    <input value={newAttachUrl} onChange={(e) => setNewAttachUrl(e.target.value)} placeholder="https://..." onKeyDown={(e) => e.key === 'Enter' && addAttachment()} />
                    <Button size="sm" onClick={addAttachment} loading={savingAttach}>Attach</Button>
                  </div>
                </details>

                {attachments.length === 0 ? (
                  <p className={styles.placeholder}>No files attached yet.</p>
                ) : (
                  <div className={styles.attachList}>
                    {attachments.map((a, i) => (
                      <div key={i} className={styles.attachItem}>
                        <span className={styles.attachIcon}>{a.type === 'image' ? '🖼' : '📄'}</span>
                        <div className={styles.attachInfo}>
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className={styles.attachName}>{a.name}</a>
                          <span className={styles.attachMeta}>{a.type} · {formatDate(a.uploadedAt)}</span>
                        </div>
                        {a.type === 'image' && (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className={styles.previewThumb}>
                            <img src={a.url} alt={a.name} />
                          </a>
                        )}
                        <button className={styles.removeBtn} onClick={() => removeAttachment(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TIMELINE */}
            {tab === 'timeline' && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Timer Activity</div>

                {timelineEntries.length === 0 ? (
                  <p className={styles.placeholder}>No timer activity yet. Start the timer to begin tracking.</p>
                ) : (
                  <div className={styles.timeline}>
                    {timelineEntries.map((ev, i) => {
                      const meta = ACTION_META[ev.action] ?? { label: ev.action, color: '#6366f1', bg: '#eef2ff' };
                      const isLast = i === timelineEntries.length - 1;
                      return (
                        <div key={i} className={styles.timelineItem}>
                          {/* Spine */}
                          <div className={styles.timelineSpine}>
                            <span
                              className={styles.timelineDot}
                              style={{ background: meta.color, boxShadow: `0 0 0 3px ${meta.bg}` }}
                            />
                            {!isLast && <div className={styles.timelineLine} />}
                          </div>

                          {/* Content */}
                          <div className={styles.timelineContent}>
                            <div className={styles.timelineHeader}>
                              <span className={styles.timelineAction} style={{ color: meta.color, background: meta.bg }}>
                                {meta.label}
                              </span>
                              <span className={styles.timelineTime}>{fmtDateTime(ev.timestamp)}</span>
                            </div>
                            {ev.durationLabel && (
                              <span className={styles.timelineDuration}>{ev.durationLabel}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Total elapsed summary */}
                    <div className={styles.timelineSummary}>
                      <Clock size={13} />
                      Total time logged:&nbsp;
                      <strong>{fmtDuration(task.totalElapsedSeconds * 1000)}</strong>
                      {task.estimatedHours != null && task.estimatedHours > 0 && (
                        <> &nbsp;/&nbsp; {task.estimatedHours}h estimated</>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* COMMENTS */}
            {tab === 'comments' && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Comments</div>
                <div className={styles.commentInput}>
                  <div className={styles.mentionWrapper}>
                    <textarea
                      rows={3}
                      placeholder="Add a comment… Use @name to mention"
                      value={newComment}
                      onChange={(e) => handleCommentChange(e.target.value)}
                    />
                    {showMentions && filteredMembers.length > 0 && (
                      <div className={styles.mentionDropdown}>
                        {filteredMembers.slice(0, 5).map((m) => (
                          <button key={m.id} className={styles.mentionItem} onClick={() => insertMention(m.name.split(' ')[0])}>
                            <Avatar name={m.name} size="sm" />
                            <span>{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="sm" onClick={handleComment}>Post</Button>
                </div>
                <div className={styles.commentList}>
                  {comments.length === 0
                    ? <p className={styles.placeholder}>No comments yet.</p>
                    : comments.map((c) => (
                        <div key={c._id} className={styles.comment}>
                          <Avatar name={c.author?.name || 'U'} size="sm" />
                          <div className={styles.commentBody}>
                            <div className={styles.commentHeader}>
                              <span className={styles.commentAuthor}>{c.author?.name}</span>
                              <span className={styles.commentTime}>{timeAgo(c.createdAt)}</span>
                            </div>
                            <p className={styles.commentText}>{c.content}</p>
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────── */}
          <aside className={styles.sidebar}>
            <div className={styles.sideCard}>
              <p className={styles.sideLabel}>Timer</p>
              <TaskTimer task={task} onUpdate={onUpdate} overrideAct={handleTimerAct} />
            </div>

            <div className={styles.sideCard}>
              <div className={styles.metaRow}>
                <span className={styles.sideLabel}>Status</span>
                <select className={styles.metaSelect} value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={!canEdit}>
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.sideLabel}>Priority</span>
                <select className={styles.metaSelect} value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  disabled={!canEdit}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.sideLabel}>Due Date</span>
                <input type="date" className={styles.metaDate} value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                  disabled={!canEdit} />
              </div>
              <div className={styles.metaRow}>
                <span className={styles.sideLabel}>Due Time</span>
                <div className={styles.dueTimeWrap}>
                  <input type="time" className={styles.metaDate} value={editDueTime}
                    onChange={(e) => setEditDueTime(e.target.value)}
                    disabled={!canEdit} />
                  {canEdit && editDueTime && (
                    <button
                      type="button"
                      className={styles.clearTimeBtn}
                      onClick={() => setEditDueTime('')}
                      title="Clear due time"
                    >✕</button>
                  )}
                </div>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.sideLabel}>Project</span>
                {canEdit && projects && projects.length > 0 ? (
                  <select
                    className={styles.metaSelect}
                    value={editProject}
                    onChange={(e) => setEditProject(e.target.value)}
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>{p.title}</option>
                    ))}
                  </select>
                ) : (
                  <span className={styles.metaValue}>
                    {task.project
                      ? typeof task.project === 'object'
                        ? (task.project as any).title
                        : task.project
                      : <span className={styles.placeholder}>—</span>
                    }
                  </span>
                )}
              </div>
              <div className={styles.metaRow}>
                <span className={styles.sideLabel}>Reporter</span>
                <div className={styles.person}>
                  <Avatar name={task.reporter?.name || 'U'} size="sm" />
                  <span className={styles.personName}>{task.reporter?.name}</span>
                </div>
              </div>
              {task.createdAt && (
                <div className={styles.metaRow}>
                  <span className={styles.sideLabel}>Created</span>
                  <span className={styles.metaValue}>{formatDate(task.createdAt)}</span>
                </div>
              )}
            </div>

          </aside>
        </div>

        <div className={styles.modalFooterBar}>
          {canDelete && onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => { onDelete(task!); onClose(); }}
            >
              <Trash2 size={14} style={{ marginRight: 4 }} />
              Delete Task
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              onClick={handleSaveAll}
              loading={saving}
              disabled={!isDirty || saving}
            >
              Save Changes
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
