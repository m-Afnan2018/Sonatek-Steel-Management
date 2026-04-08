'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import StatsCard from '@/components/dashboard/StatsCard/StatsCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed/ActivityFeed';
import ProjectProgress from '@/components/dashboard/ProjectProgress/ProjectProgress';
import TeamWorkload from '@/components/dashboard/TeamWorkload/TeamWorkload';
import CheckInButton from '@/components/attendance/CheckInButton/CheckInButton';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import api from '@/lib/api';
import type { Notification } from '@/types';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { projects, loading: projectsLoading } = useProjects();
  const { members, loading: teamLoading } = useTeam();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notifRes, taskRes] = await Promise.all([
          api.get('/notifications'),
          api.get('/tasks'),
        ]);
        setNotifications(notifRes.data);
        setTaskCount(taskRes.data.filter((t: { status: string }) =>
          ['todo', 'in_progress', 'in_review'].includes(t.status)
        ).length);
      } catch {
        // ignore
      }
    };
    fetchData();
  }, []);

  const activeProjects = projects.filter((p) => p.status === 'active');
  const loading = projectsLoading || teamLoading;

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : (
        <div className={styles.page}>
          <div className={styles.stats}>
            <StatsCard
              title="Total Projects"
              value={projects.length}
              color="var(--primary)"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
              }
            />
            <StatsCard
              title="Active Tasks"
              value={taskCount}
              color="var(--warning)"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              }
            />
            <StatsCard
              title="Team Members"
              value={members.length}
              color="var(--success)"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
              }
            />
            <StatsCard
              title="Notifications"
              value={notifications.filter((n) => !n.isRead).length}
              color="var(--danger)"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              }
            />
          </div>

          <div className={styles.grid}>
            <div className={styles.main}>
              <ProjectProgress projects={activeProjects} />
              <ActivityFeed notifications={notifications} />
            </div>
            <div className={styles.sidebar}>
              <CheckInButton />
              <TeamWorkload members={members} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
