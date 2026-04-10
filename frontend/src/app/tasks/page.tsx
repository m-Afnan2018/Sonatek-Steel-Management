'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Modal from '@/components/ui/Modal/Modal';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import TaskTimer from '@/components/tasks/TaskTimer';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/types';
import styles from './tasks.module.css';

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

export default function TasksPage() {
  const { tasks, loading, error, fetchTasks, fetchPersonalTasks, createTask, updateTaskStatus, deleteTask, patchTimer } = useTasks();
  const { projects } = useProjects();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [tab, setTab] = useState<'personal' | 'assigned'>('assigned');
  const [showCreate, setShowCreate] = useState(false);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

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
    links: [] as string[],
  });
  const [linkInput, setLinkInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tab === 'personal') fetchPersonalTasks();
    else fetchTasks();
  }, [tab, fetchTasks, fetchPersonalTasks]);

  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  const openCreate = () => {
    setForm((f) => ({ ...f, isPersonal: tab === 'personal', project: '', assignees: [] }));
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      remark: form.remark,
      priority: form.priority,
      status: form.status,
      isPersonal: form.isPersonal,
      links: form.links,
    };
    if (form.dueDate) payload.dueDate = form.dueDate;
    if (form.estimatedHours) payload.estimatedHours = parseFloat(form.estimatedHours);
    if (form.project) payload.project = form.project;
    if (form.assignees.length) payload.assignees = form.assignees;

    await createTask(payload as Partial<Task>);
    setSaving(false);
    setShowCreate(false);
    setForm({ title: '', description: '', remark: '', priority: 'medium', status: 'todo', dueDate: '', estimatedHours: '', project: '', isPersonal: tab === 'personal', assignees: [], links: [] });
  };

  const handleStatusChange = async (task: Task, status: string) => {
    const updated = await updateTaskStatus(task._id, status);
    if (updated) setLocalTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
  };

  const handleTimerUpdate = (updated: Task) => {
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

  const addLink = () => {
    if (linkInput.trim()) {
      setForm((f) => ({ ...f, links: [...f.links, linkInput.trim()] }));
      setLinkInput('');
    }
  };

  // Apply filters then split active / completed
  const filtered = useMemo(() => {
    return localTasks.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee && !t.assignees.some((a) => a.id === filterAssignee)) return false;
      return true;
    });
  }, [localTasks, filterStatus, filterPriority, filterAssignee]);

  const activeTasks = filtered.filter((t) => t.status !== 'done');
  const completedTasks = filtered.filter((t) => t.status === 'done');

  const hasFilters = filterStatus || filterPriority || filterAssignee;

  return (
    <AppShell title="Tasks">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'assigned' ? styles.active : ''}`} onClick={() => setTab('assigned')}>
              {isAdminOrManager ? 'All Tasks' : 'Assigned to Me'}
            </button>
            <button className={`${styles.tab} ${tab === 'personal' ? styles.active : ''}`} onClick={() => setTab('personal')}>
              Personal Tasks
            </button>
          </div>
          <Button onClick={openCreate}>+ New Task</Button>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <select className={styles.filterSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>
          <select className={styles.filterSelect} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          {tab === 'assigned' && members.length > 0 && (
            <select className={styles.filterSelect} value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
              <option value="">All Assignees</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button className={styles.clearFilters} onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); }}>
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : error ? (
          <div className={styles.empty} style={{ color: 'var(--danger)' }}>
            <p>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <p>
              {hasFilters
                ? 'No tasks match the current filters.'
                : tab === 'personal'
                ? 'No personal tasks. Create one to get started.'
                : tab === 'assigned' && !isAdminOrManager
                ? 'No tasks assigned to you.'
                : 'No tasks found.'}
            </p>
          </div>
        ) : (
          <>
            {/* Active tasks */}
            {activeTasks.length > 0 && (
              <div className={styles.taskList}>
                {activeTasks.map((task) => (
                  <TaskRow
                    key={task._id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onTimerUpdate={handleTimerUpdate}
                    onDelete={(t) => setDeleteConfirm(t)}
                    patchTimer={patchTimer}
                  />
                ))}
              </div>
            )}

            {/* Completed section */}
            {completedTasks.length > 0 && (
              <div className={styles.completedSection}>
                <button
                  className={styles.completedToggle}
                  onClick={() => setCompletedOpen((v) => !v)}
                >
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
                        onStatusChange={handleStatusChange}
                        onTimerUpdate={handleTimerUpdate}
                        onDelete={(t) => setDeleteConfirm(t)}
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
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Task" size="lg">
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              {form.isPersonal ? 'Personal Task' : 'Team Task'}
              <span className={styles.toggleSub}>{form.isPersonal ? 'Only visible to you' : 'Can be assigned to members'}</span>
            </span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={form.isPersonal}
                onChange={(e) => setForm((f) => ({ ...f, isPersonal: e.target.checked, project: '', assignees: [] }))}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          </div>
          <div className={styles.field}>
            <label>Remark</label>
            <input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="Short remark or note" />
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
              <label>Assign To</label>
              <select
                multiple
                value={form.assignees}
                onChange={(e) => setForm({ ...form, assignees: Array.from(e.target.selectedOptions, (o) => o.value) })}
                size={4}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <span className={styles.hint}>Hold Ctrl/Cmd to select multiple</span>
            </div>
          )}
          <div className={styles.field}>
            <label>Links</label>
            <div className={styles.linkRow}>
              <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://..." onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <Button size="sm" variant="secondary" onClick={addLink}>Add</Button>
            </div>
            {form.links.length > 0 && (
              <div className={styles.links}>
                {form.links.map((l, i) => (
                  <div key={i} className={styles.linkChip}>
                    <span>{l}</span>
                    <button onClick={() => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.title.trim()}>Create Task</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
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
  onStatusChange,
  onTimerUpdate,
  onDelete,
  patchTimer,
}: {
  task: Task;
  onStatusChange: (t: Task, status: string) => void;
  onTimerUpdate: (updated: Task) => void;
  onDelete: (t: Task) => void;
  patchTimer: (id: string, action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => Promise<Task | null>;
}) {
  const renderWorkflowBtn = () => {
    switch (task.status) {
      case 'backlog':
        return (
          <button className={`${styles.statusBtn} ${styles.statusStart}`}
            onClick={() => onStatusChange(task, 'todo')}>
            → Todo
          </button>
        );
      case 'done':
        return (
          <button className={`${styles.statusBtn} ${styles.statusReopen}`}
            onClick={() => onStatusChange(task, 'todo')}>
            ↩ Reopen
          </button>
        );
      default:
        return null;
    }
  };

  const act = async (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
    const updated = await patchTimer(task._id, action);
    if (updated) onTimerUpdate(updated);
  };

  return (
    <div className={`${styles.taskRow} ${task.status === 'done' ? styles.taskDone : ''}`}>
      <div className={styles.stepIndicator}>
        <div className={`${styles.stepDot} ${styles[`step_${task.status}`]}`} title={task.status.replace(/_/g, ' ')} />
      </div>
      <div className={styles.taskMain}>
        <div className={styles.taskTitle}>
          {task.title}
          {task.isPersonal && <span className={styles.personalBadge}>Personal</span>}
          {task.remark && <span className={styles.remarkBadge}>{task.remark}</span>}
        </div>
        <div className={styles.taskMeta}>
          {task.project && typeof task.project === 'object' && (
            <span className={styles.projectName}>{task.project.title}</span>
          )}
          {task.dueDate && <span className={styles.dueDate}>{formatDate(task.dueDate)}</span>}
          <Badge variant={priorityVariant[task.priority]} size="sm">{task.priority}</Badge>
          <Badge variant={statusVariant[task.status]} size="sm">{task.status.replace(/_/g, ' ')}</Badge>
        </div>
      </div>
      <div className={styles.taskRight}>
        <div className={styles.assignees}>
          {task.assignees.slice(0, 3).map((a) => (
            <span key={a.id || a.email} className={styles.assignee}>
              <Avatar name={a.name} size="sm" />
              <span className={styles.assigneeName}>{a.name}</span>
            </span>
          ))}
          {task.assignees.length > 3 ? (
            <span className={styles.assigneeMore}>+{task.assignees.length - 3}</span>
          ) : null}
        </div>
        <div className={styles.statusActions}>
          {renderWorkflowBtn()}
          {task.status !== 'backlog' && (
            <TaskTimer task={task} onUpdate={onTimerUpdate} overrideAct={act} />
          )}
        </div>
        <span className={styles.hours}>
          {Math.floor(task.totalElapsedSeconds / 60)}m
        </span>
        <button className={styles.deleteBtn} onClick={() => onDelete(task)} title="Delete task">
          ✕
        </button>
      </div>
    </div>
  );
}
