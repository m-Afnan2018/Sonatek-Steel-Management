'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Spinner from '@/components/ui/Spinner/Spinner';
import AdminDashboard from '@/components/dashboard/AdminDashboard/AdminDashboard';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard/ManagerDashboard';
import MemberDashboard from '@/components/dashboard/MemberDashboard/MemberDashboard';
import TaskModal from '@/components/tasks/TaskModal/TaskModal';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useTasks } from '@/hooks/useTasks';
import { useAttendance } from '@/hooks/useAttendance';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import type { Notification, Task } from '@/types';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { members, loading: teamLoading } = useTeam();
  const { departments, loading: deptLoading } = useDepartments();
  const { tasks, loading: tasksLoading, fetchTasks, createTask, updateTaskStatus, patchTimer } = useTasks();
  const { teamRecords: attendance, fetchTeamAttendance } = useAttendance();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTasks();
    api.get('/notifications')
      .then((r) => setNotifications(r.data))
      .catch(() => {})
      .finally(() => setNotifLoading(false));

    if (user?.role === 'admin') {
      const today = new Date().toISOString().split('T')[0];
      fetchTeamAttendance(today);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = teamLoading || deptLoading || tasksLoading || notifLoading;

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowModal(true);
  };

  const handleStatusChange = async (id: string, status: Task['status']) => {
    await updateTaskStatus(id, status);
  };

  const handleCreate = async (title: string) => {
    if (!user) return;
    await createTask({
      title,
      status: 'todo',
      priority: 'medium',
      assignees: [user.id] as unknown as Task['assignees'],
    } as Partial<Task>);
  };

  const handleTaskUpdate = (updated: Task) => {
    setSelectedTask(updated);
  };

  const handleTimerUpdate = (updated: Task) => {
    if (selectedTask?._id === updated._id) setSelectedTask(updated);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTask(null);
  };

  const sharedProps = {
    onTaskClick: handleTaskClick,
    onStatusChange: handleStatusChange,
    onCreate: handleCreate,
    patchTimer,
    onTimerUpdate: handleTimerUpdate,
  };

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {user?.role === 'admin' && (
            <AdminDashboard
              tasks={tasks}
              members={members}
              departments={departments}
              attendance={attendance}
              notifications={notifications}
              userId={user.id}
              userName={user.name}
              {...sharedProps}
            />
          )}
          {user?.role === 'manager' && (
            <ManagerDashboard
              tasks={tasks}
              members={members}
              departments={departments}
              notifications={notifications}
              userId={user.id}
              userName={user.name}
              {...sharedProps}
            />
          )}
          {(user?.role === 'member' || user?.role === 'viewer') && (
            <MemberDashboard
              tasks={tasks}
              notifications={notifications}
              userId={user.id}
              userName={user.name}
              role={user.role}
              {...sharedProps}
            />
          )}
        </>
      )}

      <TaskModal
        task={selectedTask}
        isOpen={showModal}
        onClose={closeModal}
        onUpdate={handleTaskUpdate}
        onSaved={closeModal}
        members={members}
      />
    </AppShell>
  );
}
