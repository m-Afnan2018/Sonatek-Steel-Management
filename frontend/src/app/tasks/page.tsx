'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Modal from '@/components/ui/Modal/Modal';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
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
  const { tasks, loading, error, fetchTasks, fetchPersonalTasks, createTask, updateTaskStatus, startTimer, pauseTimer, doneTimer } = useTasks();
  const { projects } = useProjects();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [tab, setTab] = useState<'personal' | 'assigned'>('assigned');
  const [showCreate, setShowCreate] = useState(false);
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

  useEffect(() => {
    if (tab === 'personal') {
      setForm((f) => ({ ...f, isPersonal: true, project: '' }));
    } else {
      setForm((f) => ({ ...f, isPersonal: false }));
    }
  }, [tab]);

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

  const handleTimerAction = async (task: Task, action: 'start' | 'pause' | 'done') => {
    if (action === 'start') await startTimer(task._id);
    else if (action === 'pause') await pauseTimer(task._id);
    else await doneTimer(task._id);
  };

  const handleStatusChange = async (task: Task, status: string) => {
    await updateTaskStatus(task._id, status);
  };

  const addLink = () => {
    if (linkInput.trim()) {
      setForm((f) => ({ ...f, links: [...f.links, linkInput.trim()] }));
      setLinkInput('');
    }
  };

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
          <Button onClick={() => setShowCreate(true)}>+ New Task</Button>
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : error ? (
          <div className={styles.empty} style={{ color: 'var(--danger)' }}>
            <p>{error}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.empty}>
            <p>
              {tab === 'personal'
                ? 'No personal tasks. Create one to get started.'
                : tab === 'assigned' && !isAdminOrManager
                ? 'No tasks assigned to you.'
                : 'No tasks found.'}
            </p>
          </div>
        ) : (
          <div className={styles.taskList}>
            {tasks.map((task) => (
              <TaskRow
                key={task._id}
                task={task}
                currentUserId={user?.id || ''}
                onTimer={handleTimerAction}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Task" size="lg">
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
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
    </AppShell>
  );
}

function TaskRow({ task, currentUserId, onTimer, onStatusChange }: {
  task: Task;
  currentUserId: string;
  onTimer: (t: Task, a: 'start' | 'pause' | 'done') => void;
  onStatusChange: (t: Task, status: string) => void;
}) {
  const isMyTimer = task.activeTimerUser === currentUserId;
  const isRunning = task.timerStatus === 'running';
  const isPaused = task.timerStatus === 'paused';
  const isDone = task.status === 'done';

  return (
    <div className={styles.taskRow}>
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
            <Avatar key={a.id || a.email} name={a.name} size="sm" />
          ))}
        </div>

        <div className={styles.timerActions}>
          {/* Timer controls */}
          {!isDone && (
            isRunning && isMyTimer ? (
              <>
                <span className={styles.timerRunning}>⏱ Running</span>
                <button className={styles.timerBtn} onClick={() => onTimer(task, 'pause')}>Pause Timer</button>
              </>
            ) : isPaused && isMyTimer ? (
              <>
                <span className={styles.timerPaused}>⏸ Paused</span>
                <button className={styles.timerBtn} onClick={() => onTimer(task, 'start')}>Resume</button>
              </>
            ) : isRunning ? (
              <span className={styles.timerOther}>⏱ In progress</span>
            ) : (
              <button className={styles.timerBtn} onClick={() => onTimer(task, 'start')}>▶ Start</button>
            )
          )}
        </div>

        {/* Status action buttons */}
        <div className={styles.statusActions}>
          {!isDone && task.status !== 'in_review' && (
            <button
              className={`${styles.statusBtn} ${styles.statusPause}`}
              onClick={() => onStatusChange(task, 'in_review')}
              title="Put on hold (In Review)"
            >
              ⏸ Pause
            </button>
          )}
          {task.status === 'in_review' && (
            <button
              className={`${styles.statusBtn} ${styles.statusResume}`}
              onClick={() => onStatusChange(task, 'in_progress')}
              title="Resume task"
            >
              ▶ Resume
            </button>
          )}
          {!isDone && (
            <button
              className={`${styles.statusBtn} ${styles.statusDone}`}
              onClick={() => onStatusChange(task, 'done')}
              title="Mark as done"
            >
              ✓ Done
            </button>
          )}
          {isDone && (
            <button
              className={`${styles.statusBtn} ${styles.statusReopen}`}
              onClick={() => onStatusChange(task, 'todo')}
              title="Reopen task"
            >
              ↩ Reopen
            </button>
          )}
        </div>

        <span className={styles.hours}>{task.loggedHours}h</span>
      </div>
    </div>
  );
}
