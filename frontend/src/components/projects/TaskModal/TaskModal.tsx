'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import TaskTimer from '@/components/tasks/TaskTimer';
import { formatDate, timeAgo } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import { uploadFile } from '@/lib/api';
import type { Task, Comment, User, Attachment } from '@/types';
import styles from './TaskModal.module.css';

type Tab = 'details' | 'notes' | 'links' | 'files' | 'comments';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  members: User[];
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

export default function TaskModal({ task, isOpen, onClose, onUpdate, members, patchTimer }: TaskModalProps) {
  const { updateTask, addComment } = useTasks();

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
      setComments(task.comments || []);
      setLinks(task.links || []);
      setAttachments(task.attachments || []);
      setTab('details');
      setEditingTitle(false);
      setEditingDesc(false);
    }
  }, [task]);

  if (!task) return null;

  // ── Helpers ──────────────────────────────────────────────────────
  const save = async (patch: Partial<Task>) => {
    setSaving(true);
    const updated = await updateTask(task._id, patch);
    if (updated) onUpdate(updated);
    setSaving(false);
    return updated;
  };

  const handleTitleSave = async () => {
    if (!editTitle.trim() || editTitle === task.title) { setEditingTitle(false); return; }
    await save({ title: editTitle } as Partial<Task>);
    setEditingTitle(false);
  };

  const handleDescSave = async () => {
    await save({ description: editDesc } as Partial<Task>);
    setEditingDesc(false);
  };

  const handleMetaSave = async (field: string, value: string) => {
    await save({ [field]: value } as Partial<Task>);
  };

  const handleNotesSave = async () => {
    setSavingNotes(true);
    await save({ notes: editNotes } as Partial<Task>);
    setSavingNotes(false);
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
    return undefined;
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'notes', label: 'Notes' },
    { key: 'links', label: 'Links' },
    { key: 'files', label: 'Files' },
    { key: 'comments', label: 'Comments' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className={styles.root}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            {editingTitle ? (
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
              <h2 className={styles.titleDisplay} onClick={() => setEditingTitle(true)} title="Click to edit">
                {task.title}
                <span className={styles.editHint}>✎</span>
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
                  {!editingDesc && (
                    <button className={styles.inlineEditBtn} onClick={() => setEditingDesc(true)}>Edit</button>
                  )}
                </div>
                {editingDesc ? (
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
                      <Button size="sm" onClick={handleDescSave} loading={saving}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditDesc(task.description || ''); setEditingDesc(false); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.descText} onClick={() => setEditingDesc(true)}>
                    {task.description || <span className={styles.placeholder}>Click to add description…</span>}
                  </p>
                )}

                {task.tags.length > 0 && (
                  <div className={styles.tags}>
                    {task.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                )}

                <div className={styles.sectionLabel} style={{ marginTop: '1rem' }}>Assignees</div>
                <div className={styles.assignees}>
                  {task.assignees.length === 0
                    ? <span className={styles.placeholder}>No assignees</span>
                    : task.assignees.map((a) => (
                        <div key={a.id || a.email} className={styles.person}>
                          <Avatar name={a.name} size="sm" />
                          <span>{a.name}</span>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}

            {/* NOTES */}
            {tab === 'notes' && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Notes</span>
                  <Button size="sm" onClick={handleNotesSave} loading={savingNotes}>Save</Button>
                </div>
                <textarea
                  className={styles.notesTextarea}
                  rows={14}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Write notes, checklists, or any context for this task…"
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
                      <span className={styles.dropZoneSub}>Images, PDFs, Docs, Spreadsheets — max 10 MB each</span>
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
                  onChange={(e) => { setEditStatus(e.target.value); handleMetaSave('status', e.target.value); }}>
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
                  onChange={(e) => { setEditPriority(e.target.value); handleMetaSave('priority', e.target.value); }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.sideLabel}>Due Date</span>
                <input type="date" className={styles.metaDate} value={editDue}
                  onChange={(e) => { setEditDue(e.target.value); handleMetaSave('dueDate', e.target.value); }} />
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
      </div>
    </Modal>
  );
}
