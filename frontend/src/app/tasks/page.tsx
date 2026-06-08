'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Modal from '@/components/ui/Modal/Modal';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import TaskTimer from '@/components/tasks/TaskTimer';
import TaskModal from '@/components/tasks/TaskModal/TaskModal';
import KanbanBoard from '@/components/tasks/KanbanBoard/KanbanBoard';
import SuccessPopup from '@/components/ui/SuccessPopup/SuccessPopup';
import { useTasks } from '@/hooks/useTasks';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import api, { uploadFile } from '@/lib/api';
import type { Task, Attachment } from '@/types';
import styles from './tasks.module.css';
import { Calendar, ChevronLeft, ChevronRight, ArrowUpDown, CheckSquare, Check, CornerUpRight, List, LayoutGrid } from 'lucide-react';

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
  const { tasks, loading, error, fetchTasks, fetchPersonalTasks, createTask, updateTaskStatus, deleteTask, patchTimer, delegateTask } = useTasks();
  const { members } = useTeam();
  const { departments } = useDepartments();
  const user = useAuthStore((s) => s.user);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  // Departments this user heads (if any)
  const myHeadedDepts = useMemo(
    () => departments.filter((d) =>
      d.heads?.some((h) => (h.id ?? (h as any)._id) === user?.id)
    ),
    [departments, user?.id],
  );
  const isDeptHead = !isAdminOrManager && myHeadedDepts.length > 0;

  // Deduplicated members from all headed departments
  const deptMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof members = [];
    myHeadedDepts.forEach((d) =>
      d.members.forEach((m) => {
        const id = m.id ?? (m as any)._id;
        if (id && !seen.has(id)) { seen.add(id); result.push(m as any); }
      }),
    );
    return result;
  }, [myHeadedDepts]);

  // Members the current user (as dept head) can delegate to
  const delegatableMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const d of myHeadedDepts) {
      for (const m of [...d.members, ...d.heads]) {
        const id = (m.id ?? (m as any)._id)?.toString();
        if (id && id !== user?.id && !seen.has(id)) {
          seen.add(id);
          result.push({ id, name: m.name });
        }
      }
    }
    return result;
  }, [myHeadedDepts, user?.id]);

  const handleDelegateSubmit = async () => {
    if (!delegateModal?.delegateTo) return;
    setDelegating(true);
    const result = await delegateTask(delegateModal.task._id, delegateModal.delegateTo, delegateModal.note);
    if (result) {
      setLocalTasks((prev) => prev.map((t) => (t._id === result._id ? result : t)));
      setDelegateModal(null);
    } else {
      setDelegateModal((m) => m ? { ...m, error: 'Could not delegate. Check you have permission.' } : null);
    }
    setDelegating(false);
  };

  const [tab, setTab] = useState<'personal' | 'assigned'>('assigned');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedSort, setCompletedSort] = useState<'desc' | 'asc'>('desc');
  const COMPLETED_PAGE_SIZE = 10;
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delegateModal, setDelegateModal] = useState<{ task: Task; delegateTo: string; note: string; error: string } | null>(null);
  const [delegating, setDelegating] = useState(false);
  const [successPopup, setSuccessPopup] = useState<{ visible: boolean; title: string; subtitle: string }>({ visible: false, title: '', subtitle: '' });

  const showSuccess = (title: string, subtitle: string) => setSuccessPopup({ visible: true, title, subtitle });
  const hideSuccess = () => setSuccessPopup((s) => ({ ...s, visible: false }));

  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
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
    setForm({ title: '', description: '', remark: '', priority: 'medium', status: 'todo', dueDate: '', estimatedHours: '', isPersonal: tab === 'personal', assignees: [] });
    setNotes('');
    setLinks([]);
    setLinkInput('');
    setAttachments([]);
    setFileUploadError('');
    setCreateTab('details');
  };

  const openCreate = () => {
    setForm((f) => ({ ...f, isPersonal: tab === 'personal', assignees: [] }));
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
    if (form.assignees.length) payload.assignees = form.assignees;
    await createTask(payload as Partial<Task>);
    setSaving(false);
    setShowCreate(false);
    resetCreateForm();
    showSuccess('Task Created!', 'Your new task has been added.');
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
      setFileUploadError('Upload failed. Check file type/size (max 1 GB).');
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

  // Shared predicate for everything except status (used by both sections)
  const matchesNonStatusFilters = (t: (typeof localTasks)[0]) => {
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && !t.assignees.filter(Boolean).some((a) => ((a as any)._id?.toString() || a.id) === filterAssignee)) return false;
    if (filterDateFrom && new Date(t.createdAt) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(t.createdAt) > new Date(filterDateTo + 'T23:59:59')) return false;
    return true;
  };

  // Active tasks respect the status filter pill
  const activeTasks = useMemo(() => {
    return localTasks.filter((t) => {
      if (t.status === 'done') return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return matchesNonStatusFilters(t);
    });
  }, [localTasks, filterStatus, filterPriority, filterAssignee, filterDateFrom, filterDateTo]);

  // Completed tasks — filtered, sorted by createdAt, then paginated
  const completedTasks = useMemo(() => {
    const filtered = localTasks.filter((t) => t.status === 'done' && matchesNonStatusFilters(t));
    filtered.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return completedSort === 'desc' ? diff : -diff;
    });
    return filtered;
  }, [localTasks, filterPriority, filterAssignee, filterDateFrom, filterDateTo, completedSort]);

  const completedTotalPages = Math.ceil(completedTasks.length / COMPLETED_PAGE_SIZE);
  const completedPagedTasks = completedTasks.slice(
    (completedPage - 1) * COMPLETED_PAGE_SIZE,
    completedPage * COMPLETED_PAGE_SIZE,
  );

  // Board view is always scoped to the current user's own tasks (user-wise, not team-wide)
  const boardTasks = useMemo(() => {
    return localTasks.filter((t) => {
      if (!matchesNonStatusFilters(t)) return false;
      if (tab === 'assigned' && isAdminOrManager) {
        return t.assignees.some((a) => (((a as any)._id?.toString() || a.id) === user?.id));
      }
      return true;
    });
  }, [localTasks, tab, isAdminOrManager, user?.id, filterPriority, filterAssignee, filterDateFrom, filterDateTo]);

  const hasFilters = filterStatus || filterPriority || filterAssignee || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setFilterStatus('');
    setFilterPriority('');
    setFilterAssignee('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCompletedPage(1);
  };

  // Reset page when filters or sort changes
  useEffect(() => { setCompletedPage(1); }, [
    filterPriority, filterAssignee, filterDateFrom, filterDateTo, completedSort,
  ]);

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
          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${view === 'list' ? styles.viewToggleActive : ''}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <List size={14} strokeWidth={2.5} />
                List
              </button>
              <button
                className={`${styles.viewToggleBtn} ${view === 'board' ? styles.viewToggleActive : ''}`}
                onClick={() => setView('board')}
                title="Board view — drag your tasks between statuses"
              >
                <LayoutGrid size={14} strokeWidth={2.5} />
                Board
              </button>
            </div>
            <Button onClick={openCreate}>+ New Task</Button>
          </div>
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

          {/* Assignee select */}
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
              <Calendar size={12} strokeWidth={2.5} />
            </span>
            <input
              type="date"
              className={styles.dateInput}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              title="Created from"
            />
            <span className={styles.dateRangeSep}>–</span>
            <input
              type="date"
              className={styles.dateInput}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              title="Created to"
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
        ) : view === 'board' ? (
          <KanbanBoard
            tasks={boardTasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
            onTaskUpdate={handleTimerUpdate}
            patchTimer={patchTimer}
          />
        ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
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
                    delegatableMembers={delegatableMembers}
                    onDelegateClick={(t) => setDelegateModal({ task: t, delegateTo: '', note: '', error: '' })}
                  />
                ))}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className={styles.completedSection}>
                <div className={styles.completedHeader}>
                  <button className={styles.completedToggle} onClick={() => setCompletedOpen((v) => !v)}>
                    <span className={styles.completedChevron}>{completedOpen ? '▾' : '▸'}</span>
                    Completed
                    <span className={styles.completedCount}>{completedTasks.length}</span>
                  </button>
                  {completedOpen && (
                    <button
                      className={styles.sortBtn}
                      onClick={() => setCompletedSort((s) => s === 'desc' ? 'asc' : 'desc')}
                      title="Sort by created date"
                    >
                      <ArrowUpDown size={12} strokeWidth={2.5} />
                      {completedSort === 'desc' ? 'Newest first' : 'Oldest first'}
                    </button>
                  )}
                </div>

                {completedOpen && (
                  <>
                    <div className={styles.taskList}>
                      {completedPagedTasks.map((task) => (
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
                          delegatableMembers={delegatableMembers}
                          onDelegateClick={(t) => setDelegateModal({ task: t, delegateTo: '', note: '', error: '' })}
                        />
                      ))}
                    </div>

                    {completedTotalPages > 1 && (
                      <div className={styles.pagination}>
                        <button
                          className={styles.pageBtn}
                          onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                          disabled={completedPage === 1}
                        >
                          <ChevronLeft size={14} strokeWidth={2.5} />
                        </button>
                        <span className={styles.pageInfo}>
                          {completedPage} / {completedTotalPages}
                          <span className={styles.pageTotal}> &nbsp;({completedTasks.length} tasks)</span>
                        </span>
                        <button
                          className={styles.pageBtn}
                          onClick={() => setCompletedPage((p) => Math.min(completedTotalPages, p + 1))}
                          disabled={completedPage === completedTotalPages}
                        >
                          <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </>
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
                  <input type="checkbox" checked={form.isPersonal} onChange={(e) => setForm((f) => ({ ...f, isPersonal: e.target.checked, assignees: [] }))} />
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
                  <label>Assignee</label>
                  {isAdminOrManager ? (
                    /* Admin / Manager — all team members */
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
                              assignees: checked ? [] : [m.id],
                            }))}
                          >
                            <span className={styles.assigneeInitial}>{m.name.charAt(0).toUpperCase()}</span>
                            <span>{m.name}</span>
                            {checked && (
                              <Check size={11} strokeWidth={3} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : isDeptHead ? (
                    /* Department Head — only their department members */
                    <>
                      <p className={styles.deptAssigneeHint}>
                        {myHeadedDepts.map((d) => d.name).join(', ')}
                      </p>
                      <div className={styles.assigneeGrid}>
                        {deptMembers.map((m) => {
                          const mid = m.id ?? (m as any)._id;
                          const checked = form.assignees.includes(mid);
                          return (
                            <button
                              key={mid}
                              type="button"
                              className={`${styles.assigneeChip} ${checked ? styles.assigneeChipActive : ''}`}
                              onClick={() => setForm((f) => ({
                                ...f,
                                assignees: checked ? [] : [mid],
                              }))}
                            >
                              <span className={styles.assigneeInitial}>{m.name.charAt(0).toUpperCase()}</span>
                              <span>{m.name}</span>
                              {checked && (
                                <Check size={11} strokeWidth={3} />
                              )}
                            </button>
                          );
                        })}
                        {deptMembers.length === 0 && (
                          <span className={styles.noMembers}>No members in your department yet.</span>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Regular member — assign to self only */
                    <button
                      type="button"
                      className={`${styles.assigneeChip} ${form.assignees.includes(user?.id ?? '') ? styles.assigneeChipActive : ''}`}
                      onClick={() => setForm((f) => {
                        const id = user?.id ?? '';
                        const already = f.assignees.includes(id);
                        return { ...f, assignees: already ? [] : [id] };
                      })}
                    >
                      <span className={styles.assigneeInitial}>{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
                      <span>Assign to me</span>
                      {form.assignees.includes(user?.id ?? '') && (
                        <Check size={11} strokeWidth={3} />
                      )}
                    </button>
                  )}
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
                {!attachments.length && <span className={styles.dropZoneSub}>Images, PDFs, docs — max 1 GB each</span>}
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
        onDelete={(t) => { setShowTaskModal(false); setSelectedTask(null); setDeleteConfirm(t); }}
        onSaved={() => { setShowTaskModal(false); setSelectedTask(null); showSuccess('Task Updated!', 'All changes have been saved.'); }}
        members={members}
        patchTimer={patchTimer}
      />

      <SuccessPopup
        visible={successPopup.visible}
        title={successPopup.title}
        subtitle={successPopup.subtitle}
        onDone={hideSuccess}
      />

      {/* Delegate modal */}
      <Modal
        isOpen={!!delegateModal}
        onClose={() => { setDelegateModal(null); }}
        title="Delegate Task"
        size="sm"
      >
        {delegateModal && (
          <div className={styles.delegateModalBody}>
            <p className={styles.delegateModalTask}>
              <CheckSquare size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{delegateModal.task.title}</span>
            </p>

            <div className={styles.delegateModalField}>
              <label>Delegate to</label>
              <select
                value={delegateModal.delegateTo}
                onChange={(e) => setDelegateModal((m) => m ? { ...m, delegateTo: e.target.value, error: '' } : null)}
                autoFocus
              >
                <option value="">Select a team member…</option>
                {delegatableMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.delegateModalField}>
              <label>Note <span className={styles.delegateOptional}>(optional)</span></label>
              <textarea
                rows={3}
                placeholder="Add context about why you're delegating…"
                value={delegateModal.note}
                onChange={(e) => setDelegateModal((m) => m ? { ...m, note: e.target.value } : null)}
              />
            </div>

            {delegateModal.error && (
              <p className={styles.delegateModalError}>{delegateModal.error}</p>
            )}

            <div className={styles.delegateModalActions}>
              <Button variant="ghost" onClick={() => setDelegateModal(null)} disabled={delegating}>
                Cancel
              </Button>
              <Button onClick={handleDelegateSubmit} loading={delegating} disabled={!delegateModal.delegateTo}>
                Delegate
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
  delegatableMembers,
  onDelegateClick,
}: {
  task: Task;
  currentUserId: string;
  isAdminOrManager: boolean;
  onStatusChange: (t: Task, status: string) => void;
  onTimerUpdate: (updated: Task) => void;
  onDelete: (t: Task) => void;
  onClick: (t: Task) => void;
  patchTimer: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
  delegatableMembers: { id: string; name: string }[];
  onDelegateClick: (task: Task) => void;
}) {
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date();

  const effectivePriority: keyof typeof priorityVariant =
    isOverdue ? 'critical' : task.priority;

  const isSelfAssigned = task.assignees.filter(Boolean).some(
    (a) => ((a as any)._id?.toString() || a.id) === currentUserId
  );
  const canDelegate = isSelfAssigned && delegatableMembers.length > 0;

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

  const reporterId = (task.reporter?.id || (task.reporter as any)?._id)?.toString() ?? '';
  const canDelete = isAdminOrManager || (reporterId && reporterId === currentUserId);
  const accentClass = statusAccent[task.status] ?? '';

  return (
    <div
      className={`${styles.taskRow} ${accentClass} ${task.status === 'done' ? styles.taskDone : ''} ${isOverdue ? styles.taskRowOverdue : ''}`}
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
          {task.dueDate && (
            <span className={`${styles.dueDate} ${isOverdue ? styles.dueDateOverdue : ''}`}>
              {isOverdue ? '⚠ ' : ''}{formatDate(task.dueDate)}
            </span>
          )}
          <Badge variant={priorityVariant[effectivePriority]} size="sm">
              {isOverdue && task.priority !== 'critical' ? 'critical ⚠' : effectivePriority}
            </Badge>
        </div>
      </div>

      <div className={styles.taskRight} onClick={stop}>
        {task.assignees.filter(Boolean).length > 0 && (
          <div className={styles.assignees}>
            {task.assignees.filter(Boolean).slice(0, 3).map((a) => {
              const aId = (a as any)._id?.toString() || a.id;
              const isSelf = aId === currentUserId;
              return (
                <span
                  key={aId || a.email}
                  className={`${styles.assigneeChip} ${isSelf && canDelegate ? styles.assigneeChipSelf : ''}`}
                  onClick={isSelf && canDelegate ? (e) => { stop(e); onDelegateClick(task); } : undefined}
                  title={isSelf && canDelegate ? 'Click to delegate' : undefined}
                >
                  <Avatar name={a.name || '?'} size="sm" />
                  <span className={styles.assigneeName}>{a.name}</span>
                  {isSelf && canDelegate && (
                    <CornerUpRight size={9} strokeWidth={2.5} className={styles.delegateChevron} />
                  )}
                </span>
              );
            })}
            {task.assignees.filter(Boolean).length > 3 && (
              <span className={styles.assigneeMore}>+{task.assignees.filter(Boolean).length - 3}</span>
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
