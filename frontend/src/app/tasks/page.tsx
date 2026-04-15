'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Modal from '@/components/ui/Modal/Modal';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import TaskTimer from '@/components/tasks/TaskTimer';
import TaskModal from '@/components/projects/TaskModal/TaskModal';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import api, { uploadFile } from '@/lib/api';
import type { Task, Attachment } from '@/types';
import styles from './tasks.module.css';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
type CreateTab = 'details' | 'notes' | 'links' | 'files';

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

const statusAccent: Record<string, string> = {
  backlog: styles.accentBacklog,
  todo: styles.accentTodo,
  in_progress: styles.accentInProgress,
  in_review: styles.accentInReview,
  done: styles.accentDone,
};

export default function TasksPage() {
  const { tasks, loading, error, fetchTasks, fetchPersonalTasks, createTask, updateTaskStatus, deleteTask, patchTimer } = useTasks();
  const { projects } = useProjects();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [tab, setTab] = useState<'personal' | 'assigned'>('assigned');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    remark: '',
    priority: 'medium',
    status: 'todo',
    dueDate: '',
    estimatedHours: '',
    project: '',
    isPersonal: false,
    assignees: [] as string[],
  });
  const [createTab, setCreateTab] = useState<CreateTab>('details');
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tab === 'personal') fetchPersonalTasks();
    else fetchTasks();
  }, [tab, fetchTasks, fetchPersonalTasks]);

  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  const resetCreateForm = () => {
    setForm({ title: '', description: '', remark: '', priority: 'medium', status: 'todo', dueDate: '', estimatedHours: '', project: '', isPersonal: tab === 'personal', assignees: [] });
    setNotes('');
    setLinks([]);
    setLinkInput('');
    setAttachments([]);
    setFileUploadError('');
    setCreateTab('details');
  };

  const openCreate = () => {
    setForm((f) => ({ ...f, isPersonal: tab === 'personal', project: '', assignees: [] }));
    setCreateTab('details');
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      remark: form.remark.trim() || undefined,
      priority: form.priority,
      status: form.status,
      isPersonal: form.isPersonal,
      notes: notes.trim() || undefined,
      links: links.length ? links : undefined,
      attachments: attachments.length ? attachments : undefined,
    };
    if (form.dueDate) payload.dueDate = form.dueDate;
    if (form.estimatedHours) payload.estimatedHours = parseFloat(form.estimatedHours);
    if (form.project) payload.project = form.project;
    if (form.assignees.length) payload.assignees = form.assignees;

    await createTask(payload as Partial<Task>);
    setSaving(false);
    setShowCreate(false);
    resetCreateForm();
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url || links.includes(url)) return;
    setLinks((prev) => [...prev, url]);
    setLinkInput('');
  };

  const uploadFiles = async (files: FileList | File[]) => {
    setFileUploadError('');
    setFileUploading(true);
    try {
      for (const file of Array.from(files)) {
        const data = await uploadFile(file);
        setAttachments((prev) => [...prev, {
          name: data.name, url: data.url, type: data.type, uploadedAt: new Date().toISOString(),
        }]);
      }
    } catch {
      setFileUploadError('Upload failed. Check file type/size (max 10 MB).');
    } finally {
      setFileUploading(false);
    }
  };

  const handleStatusChange = async (task: Task, status: string) => {
    const updated = await updateTaskStatus(task._id, status);
    if (updated) setLocalTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
  };

  const handleTimerUpdate = (updated: Task) => {
    setLocalTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
  };

  const handleTaskClick = async (task: Task) => {
    try {
      const { data } = await api.get(`/tasks/${task._id}`);
      setSelectedTask(data);
    } catch {
      setSelectedTask(task);
    }
    setShowTaskModal(true);
  };

  const handleTaskUpdate = (updated: Task) => {
    setSelectedTask(updated);
    setLocalTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await deleteTask(deleteConfirm._id);
    setLocalTasks((prev) => prev.filter((t) => t._id !== deleteConfirm._id));
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const filtered = useMemo(() => {
    return localTasks.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee && !t.assignees.some((a) => a.id === filterAssignee)) return false;
      if (filterProject) {
        const projId = typeof t.project === 'object' ? t.project?._id : t.project;
        if (projId !== filterProject) return false;
      }
      if (filterDateFrom && t.dueDate) {
        if (new Date(t.dueDate) < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo && t.dueDate) {
        if (new Date(t.dueDate) > new Date(filterDateTo + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [localTasks, filterStatus, filterPriority, filterAssignee, filterProject, filterDateFrom, filterDateTo]);

  const activeTasks = filtered.filter((t) => t.status !== 'done');
  const completedTasks = filtered.filter((t) => t.status === 'done');
  const hasFilters = filterStatus || filterPriority || filterAssignee || filterProject || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setFilterStatus('');
    setFilterPriority('');
    setFilterAssignee('');
    setFilterProject('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const emptyMessage = hasFilters
    ? { icon: '🔍', title: 'No matches', text: 'No tasks match the current filters.' }
    : tab === 'personal'
    ? { icon: '📋', title: 'No personal tasks', text: 'Create one to track work only you can see.' }
    : tab === 'assigned' && !isAdminOrManager
    ? { icon: '📭', title: 'Nothing assigned', text: "You don't have any tasks assigned yet." }
    : { icon: '📋', title: 'No tasks yet', text: 'Create your first task to get started.' };

  return (
    <AppShell title="Tasks">
      <div className={styles.page}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'assigned' ? styles.active : ''}`} onClick={() => setTab('assigned')}>
              {isAdminOrManager ? 'All Tasks' : 'My Tasks'}
            </button>
            <button className={`${styles.tab} ${tab === 'personal' ? styles.active : ''}`} onClick={() => setTab('personal')}>
              Personal
            </button>
          </div>
          <Button onClick={openCreate}>+ New Task</Button>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          {/* Status pills */}
          <div className={styles.filterGroup}>
            {[
              { value: '', label: 'All' },
              { value: 'backlog', label: 'Backlog' },
              { value: 'todo', label: 'Todo' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'in_review', label: 'In Review' },
              { value: 'done', label: 'Done' },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`${styles.filterPill} ${filterStatus === opt.value ? styles.filterPillActive : ''} ${opt.value ? styles[`pill_${opt.value}`] : ''}`}
                onClick={() => setFilterStatus(opt.value)}
              >
                {opt.value && <span className={`${styles.pillDot} ${styles[`dot_${opt.value}`]}`} />}
                {opt.label}
              </button>
            ))}
          </div>

          <span className={styles.filterDivider} />

          {/* Priority pills */}
          <div className={styles.filterGroup}>
            {[
              { value: '', label: 'Any' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Med' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Crit' },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`${styles.filterPill} ${filterPriority === opt.value ? styles.filterPillActive : ''} ${opt.value ? styles[`pill_p_${opt.value}`] : ''}`}
                onClick={() => setFilterPriority(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className={styles.filterDivider} />

          {/* Project + Assignee selects */}
          {projects.length > 0 && (
            <select className={styles.filterSelect} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
          )}
          {tab === 'assigned' && members.length > 0 && (
            <select className={styles.filterSelect} value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
              <option value="">All Assignees</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          {/* Date range */}
          <div className={styles.dateRange}>
            <span className={styles.dateRangeIcon}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </span>
            <input
              type="date"
              className={styles.dateInput}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              title="Due date from"
            />
            <span className={styles.dateRangeSep}>–</span>
            <input
              type="date"
              className={styles.dateInput}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              title="Due date to"
            />
          </div>

          {hasFilters && (
            <button className={styles.clearFilters} onClick={clearFilters}>✕ Clear</button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : error ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>⚠️</span>
            <p className={styles.emptyTitle}>Something went wrong</p>
            <p className={styles.emptyText}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>{emptyMessage.icon}</span>
            <p className={styles.emptyTitle}>{emptyMessage.title}</p>
            <p className={styles.emptyText}>{emptyMessage.text}</p>
          </div>
        ) : (
          <>
            {activeTasks.length > 0 && (
              <div className={styles.taskList}>
                {activeTasks.map((task) => (
                  <TaskRow
                    key={task._id}
                    task={task}
                    currentUserId={user?.id ?? ''}
                    isAdminOrManager={isAdminOrManager}
                    onStatusChange={handleStatusChange}
                    onTimerUpdate={handleTimerUpdate}
                    onDelete={(t) => setDeleteConfirm(t)}
                    onClick={handleTaskClick}
                    patchTimer={patchTimer}
                  />
                ))}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className={styles.completedSection}>
                <button className={styles.completedToggle} onClick={() => setCompletedOpen((v) => !v)}>
                  <span className={styles.completedChevron}>{completedOpen ? '▾' : '▸'}</span>
                  Completed
                  <span className={styles.completedCount}>{completedTasks.length}</span>
                </button>
                {completedOpen && (
                  <div className={styles.taskList}>
                    {completedTasks.map((task) => (
                      <TaskRow
                        key={task._id}
                        task={task}
                        currentUserId={user?.id ?? ''}
                        isAdminOrManager={isAdminOrManager}
                        onStatusChange={handleStatusChange}
                        onTimerUpdate={handleTimerUpdate}
                        onDelete={(t) => setDeleteConfirm(t)}
                        onClick={handleTaskClick}
                        patchTimer={patchTimer}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetCreateForm(); }} title="New Task" size="lg">
        <div className={styles.form}>

          {/* ── Tab bar ── */}
          <div className={styles.modalTabBar}>
            {(['details', 'notes', 'links', 'files'] as CreateTab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.modalTabBtn} ${createTab === t ? styles.modalTabBtnActive : ''}`}
                onClick={() => setCreateTab(t)}
              >
                {t === 'details' && 'Details'}
                {t === 'notes' && 'Notes'}
                {t === 'links' && (<>Links{links.length > 0 && <span className={styles.modalTabCount}>{links.length}</span>}</>)}
                {t === 'files' && (<>Files{attachments.length > 0 && <span className={styles.modalTabCount}>{attachments.length}</span>}</>)}
              </button>
            ))}
          </div>

          {/* ── Details tab ── */}
          {createTab === 'details' && (
            <div className={styles.modalTabContent}>
              <div className={styles.field}>
                <label>Title <span className={styles.req}>*</span></label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" autoFocus />
              </div>

              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>
                  {form.isPersonal ? 'Personal Task' : 'Team Task'}
                  <span className={styles.toggleSub}>{form.isPersonal ? 'Only visible to you' : 'Can be assigned to members'}</span>
                </span>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={form.isPersonal} onChange={(e) => setForm((f) => ({ ...f, isPersonal: e.target.checked, project: '', assignees: [] }))} />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <div className={styles.field}>
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add more details…" />
              </div>

              <div className={styles.field}>
                <label>Remark</label>
                <input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="Short remark visible on the task card" />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Due Date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Est. Hours</label>
                  <input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} placeholder="0" />
                </div>
              </div>

              {!form.isPersonal && (
                <div className={styles.field}>
                  <label>Project (optional)</label>
                  <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {isAdminOrManager && !form.isPersonal && (
                <div className={styles.field}>
                  <label>Assignees</label>
                  <div className={styles.assigneeGrid}>
                    {members.map((m) => {
                      const checked = form.assignees.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`${styles.assigneeChip} ${checked ? styles.assigneeChipActive : ''}`}
                          onClick={() => setForm((f) => ({
                            ...f,
                            assignees: checked
                              ? f.assignees.filter((id) => id !== m.id)
                              : [...f.assignees, m.id],
                          }))}
                        >
                          <span className={styles.assigneeInitial}>{m.name.charAt(0).toUpperCase()}</span>
                          <span>{m.name}</span>
                          {checked && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notes tab ── */}
          {createTab === 'notes' && (
            <div className={styles.modalTabContent}>
              <div className={styles.field}>
                <label>Notes</label>
                <textarea
                  className={styles.notesArea}
                  rows={12}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes, checklists, or any context for this task…"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ── Links tab ── */}
          {createTab === 'links' && (
            <div className={styles.modalTabContent}>
              <div className={styles.field}>
                <label>Add Link</label>
                <div className={styles.linkRow}>
                  <input
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="https://..."
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                    autoFocus
                  />
                  <Button size="sm" onClick={addLink} disabled={!linkInput.trim()}>Add</Button>
                </div>
              </div>
              {links.length > 0 ? (
                <div className={styles.linkItemList}>
                  {links.map((url, i) => (
                    <div key={i} className={styles.linkItem}>
                      <span className={styles.linkItemIcon}>🔗</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkItemUrl}>{url}</a>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                      >✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.tabEmpty}>No links added yet. Paste a URL above and press Add.</p>
              )}
            </div>
          )}

          {/* ── Files tab ── */}
          {createTab === 'files' && (
            <div className={styles.modalTabContent}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={styles.fileInputHidden}
                onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              />

              {/* Uploaded file list — shown FIRST so it's always visible */}
              {attachments.length > 0 && (
                <div className={styles.attachList}>
                  {attachments.map((a, i) => (
                    <div key={a.url} className={styles.attachItem}>
                      {a.type === 'image' ? (
                        <div className={styles.previewThumb}>
                          <img src={`${API_BASE}${a.url}`} alt={a.name} />
                        </div>
                      ) : (
                        <span className={styles.attachIcon}>📄</span>
                      )}
                      <div className={styles.attachInfo}>
                        <a href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer" className={styles.attachName}>{a.name}</a>
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone — compact when files already uploaded */}
              <div
                className={`${styles.dropZone} ${attachments.length > 0 ? styles.dropZoneCompact : ''} ${isDragging ? styles.dropZoneActive : ''} ${fileUploading ? styles.dropZoneUploading : ''}`}
                onClick={() => !fileUploading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
              >
                <span className={styles.dropZoneIcon}>{fileUploading ? '⏳' : '📎'}</span>
                <span className={styles.dropZoneText}>
                  {fileUploading ? 'Uploading…' : <><u>Click to browse</u> or drag &amp; drop</>}
                </span>
                {!attachments.length && <span className={styles.dropZoneSub}>Images, PDFs, docs — max 10 MB each</span>}
              </div>
              {fileUploadError && <p className={styles.uploadError}>{fileUploadError}</p>}
              {attachments.length === 0 && !fileUploading && (
                <p className={styles.tabEmpty}>No files attached yet.</p>
              )}
            </div>
          )}

          {/* ── Always-visible actions ── */}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetCreateForm(); }} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.title.trim() || fileUploading}>
              Create Task
            </Button>
          </div>
        </div>
      </Modal>

      {/* Task detail modal */}
      <TaskModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        onUpdate={handleTaskUpdate}
        members={members}
        patchTimer={patchTimer}
      />

      {/* Delete confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Task" size="sm">
        <div className={styles.deleteConfirm}>
          <p>Are you sure you want to delete <strong>{deleteConfirm?.title}</strong>? This cannot be undone.</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

function TaskRow({
  task,
  currentUserId,
  isAdminOrManager,
  onStatusChange,
  onTimerUpdate,
  onDelete,
  onClick,
  patchTimer,
}: {
  task: Task;
  currentUserId: string;
  isAdminOrManager: boolean;
  onStatusChange: (t: Task, status: string) => void;
  onTimerUpdate: (updated: Task) => void;
  onDelete: (t: Task) => void;
  onClick: (t: Task) => void;
  patchTimer: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
}) {
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date();

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const renderWorkflowBtn = () => {
    if (task.status === 'backlog') {
      return (
        <button className={`${styles.statusBtn} ${styles.statusStart}`} onClick={(e) => { stop(e); onStatusChange(task, 'todo'); }}>
          → Todo
        </button>
      );
    }
    if (task.status === 'done') {
      return (
        <button className={`${styles.statusBtn} ${styles.statusReopen}`} onClick={(e) => { stop(e); onStatusChange(task, 'todo'); }}>
          ↩ Reopen
        </button>
      );
    }
    return null;
  };

  const act = async (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
    const updated = await patchTimer(task._id, action);
    if (updated) onTimerUpdate(updated);
  };

  const canDelete = isAdminOrManager || task.reporter?.id === currentUserId;
  const accentClass = statusAccent[task.status] ?? '';

  return (
    <div
      className={`${styles.taskRow} ${accentClass} ${task.status === 'done' ? styles.taskDone : ''}`}
      onClick={() => onClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(task)}
    >
      <div className={styles.stepIndicator}>
        <div className={`${styles.stepDot} ${styles[`step_${task.status}`]}`} title={task.status.replace(/_/g, ' ')} />
      </div>

      <div className={styles.taskMain}>
        <div className={styles.taskTitle}>
          <span className={styles.taskTitleText}>{task.title}</span>
          {task.isPersonal && <span className={styles.personalBadge}>Personal</span>}
          {task.remark && <span className={styles.remarkBadge}>{task.remark}</span>}
        </div>
        <div className={styles.taskMeta}>
          {task.project && typeof task.project === 'object' && (
            <span className={styles.projectName}>{task.project.title}</span>
          )}
          {task.dueDate && (
            <span className={`${styles.dueDate} ${isOverdue ? styles.dueDateOverdue : ''}`}>
              {isOverdue ? '⚠ ' : ''}{formatDate(task.dueDate)}
            </span>
          )}
          <Badge variant={priorityVariant[task.priority]} size="sm">{task.priority}</Badge>
        </div>
      </div>

      <div className={styles.taskRight} onClick={stop}>
        {task.assignees.length > 0 && (
          <div className={styles.assignees}>
            {task.assignees.slice(0, 4).map((a) => (
              <span key={a.id || a.email} className={styles.assigneeAvatar} title={a.name}>
                <Avatar name={a.name} size="sm" />
              </span>
            ))}
            {task.assignees.length > 4 && (
              <span className={styles.assigneeMore}>+{task.assignees.length - 4}</span>
            )}
          </div>
        )}

        <div className={styles.statusActions}>
          {renderWorkflowBtn()}
          {task.status !== 'backlog' && (
            <TaskTimer task={task} onUpdate={onTimerUpdate} overrideAct={act} />
          )}
        </div>

        <span className={styles.hours}>
          {Math.floor(task.totalElapsedSeconds / 60)}m
        </span>

        {canDelete && (
          <button className={styles.deleteBtn} onClick={(e) => { stop(e); onDelete(task); }} title="Delete task">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
