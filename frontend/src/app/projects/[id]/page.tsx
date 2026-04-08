'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell/AppShell';
import KanbanBoard from '@/components/projects/KanbanBoard/KanbanBoard';
import ProjectListView from '@/components/projects/ProjectListView/ProjectListView';
import TaskModal from '@/components/projects/TaskModal/TaskModal';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatStatus } from '@/lib/utils';
import type { Project, Task } from '@/types';
import styles from './projectDetail.module.css';

type TabType = 'board' | 'list' | 'members';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { fetchProject } = useProjects(false);
  const { tasks, loading: tasksLoading, fetchTasks, createTask, updateTaskStatus } = useTasks();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);

  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [loading, setLoading] = useState(true);

  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

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

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await createTask({
      title: newTaskTitle,
      project: projectId,
      priority: newTaskPriority as Task['priority'],
      assignees: newTaskAssignee ? [newTaskAssignee as unknown as import('@/types').User] : [],
    });

    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setNewTaskAssignee('');
    setShowCreateTask(false);
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
              <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
              <span>{project.totalTasks || 0} tasks</span>
            </div>
            <ProgressBar value={project.progress} showLabel />
          </div>
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

          <div className={styles.tabActions}>
            <Button size="sm" onClick={() => setShowCreateTask(!showCreateTask)}>
              + Add Task
            </Button>
          </div>
        </div>

        {showCreateTask && (
          <form onSubmit={handleCreateTask} className={styles.createForm}>
            <input
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
              autoFocus
            />
            <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Button type="submit" size="sm">Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateTask(false)}>
              Cancel
            </Button>
          </form>
        )}

        {activeTab === 'board' && (
          tasksLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : (
            <KanbanBoard
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
            />
          )
        )}

        {activeTab === 'list' && (
          <ProjectListView tasks={tasks} onTaskClick={handleTaskClick} />
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
      </div>

      <TaskModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        onUpdate={handleTaskUpdate}
        members={members}
      />
    </AppShell>
  );
}
