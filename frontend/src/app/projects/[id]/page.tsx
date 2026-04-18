'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell/AppShell';
import KanbanBoard from '@/components/projects/KanbanBoard/KanbanBoard';
import ProjectListView from '@/components/projects/ProjectListView/ProjectListView';
import TaskModal from '@/components/projects/TaskModal/TaskModal';
import SuccessPopup from '@/components/ui/SuccessPopup/SuccessPopup';
import MediaLibrary from '@/components/projects/MediaLibrary/MediaLibrary';
import ProjectCalendar from '@/components/projects/ProjectCalendar/ProjectCalendar';
import EditProjectModal from '@/components/projects/EditProjectModal/EditProjectModal';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatStatus } from '@/lib/utils';
import api, { uploadFile } from '@/lib/api';
import type { Project, Task, User, Attachment } from '@/types';
import styles from './projectDetail.module.css';
import createStyles from './createTask.module.css';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

type CreateTab = 'details' | 'notes' | 'links' | 'files';

type TabType = 'board' | 'list' | 'members' | 'media' | 'calendar' | 'links';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { fetchProject, updateProject } = useProjects(false);
  const { tasks, loading: tasksLoading, fetchTasks, createTask, updateTaskStatus, patchTimer } = useTasks();
  const { members } = useTeam();
  const { departments } = useDepartments();
  const user = useAuthStore((s) => s.user);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  // Departments this user heads
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

  const [project, setProject] = useState<Project | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [showEdit, setShowEdit] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create task modal form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskStatus, setNewTaskStatus] = useState('todo');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskEstHours, setNewTaskEstHours] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskLinks, setNewTaskLinks] = useState<string[]>([]);
  const [newTaskLinkInput, setNewTaskLinkInput] = useState('');
  const [newTaskAttachments, setNewTaskAttachments] = useState<Attachment[]>([]);
  const [createTab, setCreateTab] = useState<CreateTab>('details');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [successPopup, setSuccessPopup] = useState<{ visible: boolean; title: string; subtitle: string }>({ visible: false, title: '', subtitle: '' });

  const showSuccess = (title: string, subtitle: string) => setSuccessPopup({ visible: true, title, subtitle });
  const hideSuccess = () => setSuccessPopup((s) => ({ ...s, visible: false }));

  // Links state
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);
  const [editingLinkIdx, setEditingLinkIdx] = useState<number | null>(null);
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const p = await fetchProject(projectId);
    if (p) setProject(p);
    await fetchTasks({ projectId });
    setLoading(false);
  }, [projectId, fetchProject, fetchTasks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep local copy in sync; updated by timer actions without full reload
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  const handleTaskTimerUpdate = (updated: Task) => {
    setLocalTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    if (selectedTask?._id === updated._id) setSelectedTask(updated);
  };

  const handleTaskClick = async (task: Task) => {
    const { default: api } = await import('@/lib/api');
    try {
      const { data } = await api.get(`/tasks/${task._id}`);
      setSelectedTask(data);
      setShowTaskModal(true);
    } catch {
      setSelectedTask(task);
      setShowTaskModal(true);
    }
  };

  const handleStatusChange = async (taskId: string, status: string, order?: number) => {
    await updateTaskStatus(taskId, status, order);
  };

  const resetCreateForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setNewTaskStatus('todo');
    setNewTaskDueDate('');
    setNewTaskEstHours('');
    setNewTaskAssignees([]);
    setNewTaskNotes('');
    setNewTaskLinks([]);
    setNewTaskLinkInput('');
    setNewTaskAttachments([]);
    setCreateTab('details');
    setFileUploadError('');
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setCreateSubmitting(true);
    try {
      await createTask({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        project: projectId,
        priority: newTaskPriority as Task['priority'],
        status: newTaskStatus as Task['status'],
        dueDate: newTaskDueDate || undefined,
        estimatedHours: newTaskEstHours ? Number(newTaskEstHours) : undefined,
        assignees: newTaskAssignees as unknown as User[],
        notes: newTaskNotes.trim() || undefined,
        links: newTaskLinks.length ? newTaskLinks : undefined,
        attachments: newTaskAttachments.length ? newTaskAttachments : undefined,
      });
      resetCreateForm();
      setShowCreateTask(false);
      showSuccess('Task Created!', 'Your new task has been added to the board.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setNewTaskAssignees((prev) =>
      prev.includes(userId) ? [] : [userId]
    );
  };

  const addLink = () => {
    const url = newTaskLinkInput.trim();
    if (!url || newTaskLinks.includes(url)) return;
    setNewTaskLinks((prev) => [...prev, url]);
    setNewTaskLinkInput('');
  };

  const removeLink = (url: string) => {
    setNewTaskLinks((prev) => prev.filter((l) => l !== url));
  };

  const uploadFiles = async (files: FileList | File[]) => {
    setFileUploadError('');
    setFileUploading(true);
    try {
      for (const file of Array.from(files)) {
        const data = await uploadFile(file);
        setNewTaskAttachments((prev) => [...prev, {
          name: data.name, url: data.url, type: data.type, uploadedAt: new Date().toISOString(),
        }]);
      }
    } catch {
      setFileUploadError('Upload failed. Check file type/size (max 10 MB).');
    } finally {
      setFileUploading(false);
    }
  };

  const removeAttachment = (url: string) => {
    setNewTaskAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  const getFileIcon = (type: string) => {
    if (type === 'image') return '🖼️';
    return '📄';
  };

  const handleTaskUpdate = (updated: Task) => {
    setSelectedTask(updated);
    loadData();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the project?')) return;
    const { default: api } = await import('@/lib/api');
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
      const updated = await fetchProject(projectId);
      if (updated) setProject(updated);
    } catch {
      // ignore
    }
  };

  const saveLinks = async (links: { title: string; url: string }[]) => {
    setSavingLinks(true);
    const updated = await updateProject(projectId, { links } as any);
    if (updated) setProject(updated);
    setSavingLinks(false);
  };

  const handleAddLink = async () => {
    const t = linkTitle.trim();
    const u = linkUrl.trim();
    if (!t || !u) return;
    const existing = project?.links || [];
    await saveLinks([...existing, { title: t, url: u }]);
    setLinkTitle('');
    setLinkUrl('');
  };

  const handleDeleteLink = async (idx: number) => {
    const updated = (project?.links || []).filter((_, i) => i !== idx);
    await saveLinks(updated);
  };

  const handleEditLink = (idx: number) => {
    const link = project?.links?.[idx];
    if (!link) return;
    setEditingLinkIdx(idx);
    setEditLinkTitle(link.title);
    setEditLinkUrl(link.url);
  };

  const handleSaveEditLink = async () => {
    if (editingLinkIdx === null) return;
    const t = editLinkTitle.trim();
    const u = editLinkUrl.trim();
    if (!t || !u) return;
    const updated = (project?.links || []).map((l, i) =>
      i === editingLinkIdx ? { title: t, url: u } : l
    );
    await saveLinks(updated);
    setEditingLinkIdx(null);
  };

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  if (loading) {
    return (
      <AppShell>
        <div className={styles.loading}><Spinner size="lg" /></div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className={styles.loading}><p>Project not found</p></div>
      </AppShell>
    );
  }

  return (
    <AppShell title={project.title}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.badges}>
              <Badge variant="primary">{formatStatus(project.status)}</Badge>
              <Badge variant="warning">{project.priority}</Badge>
            </div>
            <p className={styles.desc}>{project.description}</p>
            <div className={styles.meta}>
              <span>{formatDate(project.startDate)}{project.endDate ? ` – ${formatDate(project.endDate)}` : ''}</span>
              <span>{project.totalTasks || 0} tasks</span>
            </div>
            <ProgressBar value={project.progress} showLabel />
          </div>
          {canManage && (
            <button className={styles.editBtn} onClick={() => setShowEdit(true)} title="Edit project">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'board' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('board')}
          >
            Board
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'list' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('list')}
          >
            List
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({project.members.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'media' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('media')}
          >
            Media
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'calendar' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'links' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('links')}
          >
            Links{project.links && project.links.length > 0 && <span className={styles.tabBadge}>{project.links.length}</span>}
          </button>

          <div className={styles.tabActions}>
            <Button size="sm" onClick={() => setShowCreateTask(true)}>
              + Add Task
            </Button>
          </div>
        </div>

        {activeTab === 'board' && (
          tasksLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : (
            <KanbanBoard
              tasks={localTasks}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
              onTaskUpdate={handleTaskTimerUpdate}
              patchTimer={patchTimer}
            />
          )
        )}

        {activeTab === 'list' && (
          <ProjectListView
            tasks={localTasks}
            onTaskClick={handleTaskClick}
            onTaskUpdate={handleTaskTimerUpdate}
            patchTimer={patchTimer}
          />
        )}

        {activeTab === 'members' && (
          <div className={styles.membersList}>
            {project.members.map((m) => (
              <div key={m.user?.id || m.user?.email} className={styles.memberItem}>
                <Avatar name={m.user?.name || 'U'} size="md" />
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.user?.name}</span>
                  <span className={styles.memberEmail}>{m.user?.email}</span>
                </div>
                <Badge variant={m.role === 'lead' ? 'warning' : 'default'}>{m.role}</Badge>
                {canManage && m.role !== 'lead' && (
                  <button
                    className={styles.removeBtn}
                    title="Remove member"
                    onClick={() => handleRemoveMember(m.user?.id || '')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'media' && (
          <MediaLibrary projectId={projectId} />
        )}

        {activeTab === 'calendar' && (
          <ProjectCalendar projectId={projectId} />
        )}

        {activeTab === 'links' && (
          <div className={styles.linksPanel}>
            {/* Add link form — admins/managers only */}
            {canManage && (
              <div className={styles.linkAddCard}>
                <h3 className={styles.linkAddTitle}>Add Link</h3>
                <div className={styles.linkAddRow}>
                  <input
                    className={styles.linkInput}
                    placeholder="Title (e.g. Figma Design)"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  />
                  <input
                    className={styles.linkInput}
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  />
                  <button
                    className={styles.linkAddBtn}
                    onClick={handleAddLink}
                    disabled={!linkTitle.trim() || !linkUrl.trim() || savingLinks}
                  >
                    {savingLinks ? '…' : '+ Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Link list */}
            {!project.links || project.links.length === 0 ? (
              <div className={styles.linksEmpty}>
                <span className={styles.linksEmptyIcon}>🔗</span>
                <p>No links added yet.</p>
                {canManage && <p className={styles.linksEmptySub}>Use the form above to add your first link.</p>}
              </div>
            ) : (
              <div className={styles.linkList}>
                {project.links.map((link, idx) => (
                  <div key={idx} className={styles.linkItem}>
                    {editingLinkIdx === idx ? (
                      /* Inline edit row */
                      <div className={styles.linkEditRow}>
                        <input
                          className={styles.linkInput}
                          value={editLinkTitle}
                          onChange={(e) => setEditLinkTitle(e.target.value)}
                          placeholder="Title"
                          autoFocus
                        />
                        <input
                          className={styles.linkInput}
                          value={editLinkUrl}
                          onChange={(e) => setEditLinkUrl(e.target.value)}
                          placeholder="https://..."
                        />
                        <button className={styles.linkSaveBtn} onClick={handleSaveEditLink} disabled={savingLinks}>Save</button>
                        <button className={styles.linkCancelBtn} onClick={() => setEditingLinkIdx(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className={styles.linkIcon}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                          </svg>
                        </span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkTitle}
                        >
                          {link.title}
                          <svg className={styles.linkExtIcon} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                        {canManage && (
                          <div className={styles.linkActions}>
                            <button className={styles.linkEditBtn} onClick={() => handleEditLink(idx)} title="Edit">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button className={styles.linkDeleteBtn} onClick={() => handleDeleteLink(idx)} title="Delete">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <TaskModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        onUpdate={handleTaskUpdate}
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

      {/* ── Edit Project Modal ── */}
      {canManage && project && (
        <EditProjectModal
          isOpen={showEdit}
          project={project}
          members={members}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setProject(updated); setShowEdit(false); }}
        />
      )}

      {/* ── Create Task Modal ── */}
      <Modal
        isOpen={showCreateTask}
        onClose={() => { setShowCreateTask(false); resetCreateForm(); }}
        title="Create New Task"
        size="lg"
      >
        <div className={createStyles.form}>
          {/* Tab bar */}
          <div className={createStyles.tabBar}>
            {(['details', 'notes', 'links', 'files'] as CreateTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`${createStyles.tabBtn} ${createTab === tab ? createStyles.tabBtnActive : ''}`}
                onClick={() => setCreateTab(tab)}
              >
                {tab === 'details' && 'Details'}
                {tab === 'notes' && 'Notes'}
                {tab === 'links' && (
                  <>Links{newTaskLinks.length > 0 && <span className={createStyles.tabCount}>{newTaskLinks.length}</span>}</>
                )}
                {tab === 'files' && (
                  <>Files{newTaskAttachments.length > 0 && <span className={createStyles.tabCount}>{newTaskAttachments.length}</span>}</>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Details */}
          {createTab === 'details' && (
            <div className={createStyles.tabContent}>
              <div className={createStyles.field}>
                <label className={createStyles.label}>Title <span className={createStyles.req}>*</span></label>
                <input
                  className={createStyles.input}
                  placeholder="What needs to be done?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={createStyles.field}>
                <label className={createStyles.label}>Description</label>
                <textarea
                  className={createStyles.textarea}
                  placeholder="Add more details..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className={createStyles.row}>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Status</label>
                  <select className={createStyles.select} value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)}>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="on_hold">On Hold</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Priority</label>
                  <select className={createStyles.select} value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className={createStyles.row}>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Due Date</label>
                  <input type="date" className={createStyles.input} value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} />
                </div>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Estimated Hours</label>
                  <input type="number" min="0" step="0.5" className={createStyles.input} placeholder="e.g. 4" value={newTaskEstHours} onChange={(e) => setNewTaskEstHours(e.target.value)} />
                </div>
              </div>

              <div className={createStyles.field}>
                <label className={createStyles.label}>Assignee</label>
                {isDeptHead && (
                  <p className={createStyles.deptAssigneeHint}>
                    {myHeadedDepts.map((d) => d.name).join(', ')}
                  </p>
                )}
                <div className={createStyles.assigneeGrid}>
                  {(isAdminOrManager ? members : isDeptHead ? deptMembers : []).map((m) => {
                    const mid = m.id ?? (m as any)._id;
                    const checked = newTaskAssignees.includes(mid);
                    return (
                      <button
                        key={mid}
                        type="button"
                        className={`${createStyles.assigneeChip} ${checked ? createStyles.assigneeChipActive : ''}`}
                        onClick={() => toggleAssignee(mid)}
                      >
                        <span className={createStyles.assigneeInitial}>{m.name.charAt(0).toUpperCase()}</span>
                        <span className={createStyles.assigneeName}>{m.name}</span>
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  {!isAdminOrManager && !isDeptHead && (
                    /* Regular member — assign to self only */
                    <button
                      type="button"
                      className={`${createStyles.assigneeChip} ${newTaskAssignees.includes(user?.id ?? '') ? createStyles.assigneeChipActive : ''}`}
                      onClick={() => toggleAssignee(user?.id ?? '')}
                    >
                      <span className={createStyles.assigneeInitial}>{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
                      <span className={createStyles.assigneeName}>Assign to me</span>
                      {newTaskAssignees.includes(user?.id ?? '') && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )}
                  {isAdminOrManager && members.length === 0 && (
                    <span className={createStyles.noMembers}>No members in this project yet.</span>
                  )}
                  {isDeptHead && deptMembers.length === 0 && (
                    <span className={createStyles.noMembers}>No members in your department yet.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Notes */}
          {createTab === 'notes' && (
            <div className={createStyles.tabContent}>
              <div className={createStyles.field}>
                <label className={createStyles.label}>Notes</label>
                <textarea
                  className={`${createStyles.textarea} ${createStyles.notesTextarea}`}
                  placeholder="Add internal notes, context, or anything relevant to this task…"
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Tab: Links */}
          {createTab === 'links' && (
            <div className={createStyles.tabContent}>
              <div className={createStyles.field}>
                <label className={createStyles.label}>Add Link</label>
                <div className={createStyles.addRow}>
                  <input
                    className={createStyles.input}
                    placeholder="https://example.com"
                    value={newTaskLinkInput}
                    onChange={(e) => setNewTaskLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                    autoFocus
                  />
                  <Button size="sm" onClick={addLink} disabled={!newTaskLinkInput.trim()}>Add</Button>
                </div>
              </div>
              {newTaskLinks.length > 0 && (
                <div className={createStyles.linkList}>
                  {newTaskLinks.map((url) => (
                    <div key={url} className={createStyles.linkItem}>
                      <span className={createStyles.linkIcon}>🔗</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className={createStyles.linkUrl}>{url}</a>
                      <button type="button" className={createStyles.removeBtn} onClick={() => removeLink(url)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {newTaskLinks.length === 0 && (
                <p className={createStyles.emptyHint}>No links added yet. Paste a URL above and click Add.</p>
              )}
            </div>
          )}

          {/* Tab: Files */}
          {createTab === 'files' && (
            <div className={createStyles.tabContent}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={createStyles.fileInputHidden}
                onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }}
              />

              {/* Uploaded file list — shown FIRST so it's always visible */}
              {newTaskAttachments.length > 0 && (
                <div className={createStyles.attachList}>
                  {newTaskAttachments.map((a) => (
                    <div key={a.url} className={createStyles.attachItem}>
                      {a.type === 'image' ? (
                        <div className={createStyles.previewThumb}>
                          <img src={`${API_BASE}${a.url}`} alt={a.name} />
                        </div>
                      ) : (
                        <span className={createStyles.attachIcon}>{getFileIcon(a.type)}</span>
                      )}
                      <div className={createStyles.attachInfo}>
                        <a href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer" className={createStyles.attachName}>{a.name}</a>
                      </div>
                      <button type="button" className={createStyles.removeBtn} onClick={() => removeAttachment(a.url)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone — compact when files already uploaded */}
              <div
                className={`${createStyles.dropZone} ${newTaskAttachments.length > 0 ? createStyles.dropZoneCompact : ''} ${isDragging ? createStyles.dropZoneActive : ''} ${fileUploading ? createStyles.dropZoneUploading : ''}`}
                onClick={() => !fileUploading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
                }}
              >
                <span className={createStyles.dropZoneIcon}>{fileUploading ? '⏳' : '📎'}</span>
                <span className={createStyles.dropZoneText}>
                  {fileUploading ? 'Uploading…' : <><u>Click to browse</u> or drag &amp; drop</>}
                </span>
                {!newTaskAttachments.length && <span className={createStyles.dropZoneSub}>Images, PDFs, docs — max 10 MB each</span>}
              </div>
              {fileUploadError && <p className={createStyles.uploadError}>{fileUploadError}</p>}
              {newTaskAttachments.length === 0 && !fileUploading && (
                <p className={createStyles.emptyHint}>No files attached yet.</p>
              )}
            </div>
          )}

          {/* Always-visible actions */}
          <div className={createStyles.actions}>
            <Button variant="ghost" onClick={() => { setShowCreateTask(false); resetCreateForm(); }} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || createSubmitting || fileUploading}>
              {createSubmitting ? 'Creating…' : 'Create Task'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
