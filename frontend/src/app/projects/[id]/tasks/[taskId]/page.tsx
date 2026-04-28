'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useTasks } from '@/hooks/useTasks';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatStatus, timeAgo } from '@/lib/utils';
import type { Task, Comment } from '@/types';
import styles from './taskDetail.module.css';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;
  const { fetchTask, updateTask, addComment, logHours: logTaskHours, patchTimer, delegateTask } = useTasks();
  const { departments } = useDepartments();
  const currentUser = useAuthStore((s) => s.user);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [hoursInput, setHoursInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');

  // Delegation state
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateTo, setDelegateTo] = useState('');
  const [delegateNote, setDelegateNote] = useState('');
  const [delegating, setDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState('');

  // Departments where current user is a head
  const myHeadDepts = useMemo(
    () => departments.filter((d) =>
      d.heads.some((h) => h.id === currentUser?.id || (h as any)._id === currentUser?.id)
    ),
    [departments, currentUser?.id]
  );

  // Members the current user can delegate to (dept members, excluding self)
  const delegatableMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const d of myHeadDepts) {
      for (const m of [...d.members, ...d.heads]) {
        const id = (m as any)._id || m.id;
        if (id && id !== currentUser?.id && !seen.has(id)) {
          seen.add(id);
          result.push({ id, name: m.name });
        }
      }
    }
    return result;
  }, [myHeadDepts, currentUser?.id]);

  const isAssignee = task?.assignees.some(
    (a) => a.id === currentUser?.id || (a as any)._id === currentUser?.id
  ) ?? false;
  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canDelegate = isAssignee && (myHeadDepts.length > 0 || isAdminOrManager);

  useEffect(() => {
    const load = async () => {
      const t = await fetchTask(taskId);
      if (t) {
        setTask(t);
        setEditStatus(t.status);
        setEditPriority(t.priority);
      }
      setLoading(false);
    };
    load();
  }, [taskId, fetchTask]);

  const handleSave = async () => {
    if (!task) return;
    const updated = await updateTask(task._id, { status: editStatus as Task['status'], priority: editPriority as Task['priority'] });
    if (updated) {
      setTask({ ...task, ...updated });
      setEditing(false);
    }
  };

  const handleComment = async () => {
    if (!task || !newComment.trim()) return;
    const comment = await addComment(task._id, newComment);
    if (comment && task.comments) {
      setTask({ ...task, comments: [comment, ...task.comments] });
    }
    setNewComment('');
  };

  const handleLogHours = async () => {
    if (!task) return;
    const h = parseFloat(hoursInput);
    if (isNaN(h) || h <= 0) return;
    const updated = await logTaskHours(task._id, h);
    if (updated) setTask(updated);
    setHoursInput('');
  };

  const handleTimer = async (action: 'start' | 'pause' | 'resume' | 'hold' | 'finish') => {
    if (!task) return;
    const result = await patchTimer(task._id, action);
    if (result) setTask(result);
  };

  const handleDelegate = async () => {
    if (!task || !delegateTo) return;
    setDelegating(true);
    setDelegateError('');
    const result = await delegateTask(task._id, delegateTo, delegateNote);
    if (result) {
      setTask(result);
      setShowDelegate(false);
      setDelegateTo('');
      setDelegateNote('');
    } else {
      setDelegateError('Failed to delegate. Check you have permission.');
    }
    setDelegating(false);
  };

  if (loading) {
    return <AppShell><div className={styles.loading}><Spinner size="lg" /></div></AppShell>;
  }

  if (!task) {
    return <AppShell><div className={styles.loading}><p>Task not found</p></div></AppShell>;
  }

  return (
    <AppShell title={task.title}>
      <div className={styles.page}>
        <button className={styles.back} onClick={() => router.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to project
        </button>

        <div className={styles.content}>
          <div className={styles.main}>
            <h1 className={styles.title}>{task.title}</h1>

            <div className={styles.badges}>
              <Badge variant="primary">{formatStatus(task.status)}</Badge>
              <Badge variant="warning">{task.priority}</Badge>
              {task.dueDate && <span className={styles.due}>Due {formatDate(task.dueDate)}</span>}
            </div>

            {task.description && (
              <div className={styles.section}>
                <h3>Description</h3>
                <p className={styles.desc}>{task.description}</p>
              </div>
            )}

            {editing ? (
              <div className={styles.editRow}>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <Button size="sm" onClick={handleSave}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            )}

            <div className={styles.section}>
              <h3>Time Tracking</h3>
              <p>{Math.floor(task.totalElapsedSeconds / 60)}m logged{task.estimatedHours ? ` / ${task.estimatedHours}h estimated` : ''}</p>
              <div className={styles.logRow}>
                <input
                  type="number"
                  placeholder="Hours"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                  min="0"
                  step="0.5"
                  style={{ maxWidth: 100 }}
                />
                <Button size="sm" onClick={handleLogHours}>Log Hours</Button>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Comments</h3>
              <div className={styles.commentForm}>
                <textarea
                  rows={2}
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <Button size="sm" onClick={handleComment}>Post</Button>
              </div>
              <div className={styles.comments}>
                {(task.comments || []).map((c: Comment) => (
                  <div key={c._id} className={styles.comment}>
                    <Avatar name={c.author?.name || 'U'} size="sm" />
                    <div>
                      <span className={styles.commentAuthor}>{c.author?.name}</span>
                      <span className={styles.commentTime}>{timeAgo(c.createdAt)}</span>
                      <p className={styles.commentText}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.sidebar}>
            {task.timerStatus !== 'finished' && (
              <div className={styles.sideSection}>
                <h4>Timer</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {task.timerStatus === 'idle' && (
                    <Button size="sm" onClick={() => handleTimer('start')}>▶ Start Timer</Button>
                  )}
                  {task.timerStatus === 'running' && (
                    <>
                      <span style={{ color: 'var(--success)', fontSize: '0.8125rem', alignSelf: 'center' }}>⏱ Running</span>
                      <Button size="sm" variant="secondary" onClick={() => handleTimer('pause')}>Pause</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleTimer('hold')}>On Hold</Button>
                      <Button size="sm" variant="danger" onClick={() => handleTimer('finish')}>Finish</Button>
                    </>
                  )}
                  {(task.timerStatus === 'paused' || task.timerStatus === 'on_hold') && (
                    <>
                      <span style={{ color: 'var(--warning)', fontSize: '0.8125rem', alignSelf: 'center' }}>
                        {task.timerStatus === 'on_hold' ? '⏸ On Hold' : '⏸ Paused'}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => handleTimer('resume')}>Resume</Button>
                      <Button size="sm" variant="danger" onClick={() => handleTimer('finish')}>Finish</Button>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className={styles.sideSection}>
              <h4>Assignees</h4>
              {task.assignees.map((a) => (
                <div key={(a as any)._id || a.id || a.email} className={styles.person}>
                  <Avatar name={a.name} size="sm" />
                  <span>{a.name}</span>
                </div>
              ))}
              {canDelegate && (
                <button className={styles.delegateBtn} onClick={() => setShowDelegate(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 004 4h12"/>
                  </svg>
                  Delegate
                </button>
              )}
            </div>

            {/* Delegation history */}
            {(task.delegations ?? []).length > 0 && (
              <div className={styles.sideSection}>
                <h4>Delegations</h4>
                {task.delegations.map((d) => (
                  <div key={d._id} className={styles.delegationEntry}>
                    <span className={styles.delegationLine}>
                      <strong>{d.delegatedBy?.name}</strong> → <strong>{d.delegatedTo?.name}</strong>
                    </span>
                    {d.note && <span className={styles.delegationNote}>"{d.note}"</span>}
                    <span className={styles.delegationTime}>{timeAgo(d.delegatedAt)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.sideSection}>
              <h4>Reporter</h4>
              <div className={styles.person}>
                <Avatar name={task.reporter?.name || 'U'} size="sm" />
                <span>{task.reporter?.name}</span>
              </div>
            </div>
            {task.tags.length > 0 && (
              <div className={styles.sideSection}>
                <h4>Tags</h4>
                <div className={styles.tags}>
                  {task.tags.map((t) => (
                    <Badge key={t} variant="default">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Delegate modal */}
      {showDelegate && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowDelegate(false); }}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Delegate Task</h3>

            <div className={styles.modalField}>
              <label>Delegate to</label>
              <select value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)}>
                <option value="">Select a team member…</option>
                {delegatableMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.modalField}>
              <label>Note (optional)</label>
              <textarea
                rows={3}
                placeholder="Add a note about this delegation…"
                value={delegateNote}
                onChange={(e) => setDelegateNote(e.target.value)}
              />
            </div>

            {delegateError && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--danger)' }}>{delegateError}</p>
            )}

            <div className={styles.modalActions}>
              <Button variant="ghost" size="sm" onClick={() => { setShowDelegate(false); setDelegateError(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleDelegate} loading={delegating} disabled={!delegateTo}>
                Delegate
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
