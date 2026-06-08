'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import StatsCard from '@/components/dashboard/StatsCard/StatsCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed/ActivityFeed';
import TeamWorkload from '@/components/dashboard/TeamWorkload/TeamWorkload';
import CheckInButton from '@/components/attendance/CheckInButton/CheckInButton';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useTeam } from '@/hooks/useTeam';
import api from '@/lib/api';
import type { Notification } from '@/types';
import styles from './dashboard.module.css';
import { ListTodo, CheckSquare, Users, Bell } from 'lucide-react';

export default function DashboardPage() {
  const { members, loading: teamLoading } = useTeam();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [totalTaskCount, setTotalTaskCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notifRes, taskRes] = await Promise.all([
          api.get('/notifications'),
          api.get('/tasks'),
        ]);
        setNotifications(notifRes.data);
        setTotalTaskCount(taskRes.data.length);
        setTaskCount(taskRes.data.filter((t: { status: string }) =>
          ['todo', 'in_progress', 'in_review'].includes(t.status)
        ).length);
      } catch {
        // ignore
      }
    };
    fetchData();
  }, []);

  const loading = teamLoading;

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
              title="Total Tasks"
              value={totalTaskCount}
              color="var(--primary)"
              icon={<ListTodo size={22} />}
            />
            <StatsCard
              title="Active Tasks"
              value={taskCount}
              color="var(--warning)"
              icon={<CheckSquare size={22} />}
            />
            <StatsCard
              title="Team Members"
              value={members.length}
              color="var(--success)"
              icon={<Users size={22} />}
            />
            <StatsCard
              title="Notifications"
              value={notifications.filter((n) => !n.isRead).length}
              color="var(--danger)"
              icon={<Bell size={22} />}
            />
          </div>

          <div className={styles.grid}>
            <div className={styles.main}>
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
