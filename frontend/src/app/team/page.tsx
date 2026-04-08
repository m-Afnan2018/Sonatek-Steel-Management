'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import MemberCard from '@/components/team/MemberCard/MemberCard';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import Badge from '@/components/ui/Badge/Badge';
import { useTeam } from '@/hooks/useTeam';
import { formatStatus } from '@/lib/utils';
import api from '@/lib/api';
import type { Task } from '@/types';
import styles from './team.module.css';

export default function TeamPage() {
  const { members, loading } = useTeam();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const handleMemberClick = async (memberId: string) => {
    setSelectedMember(memberId);
    setTasksLoading(true);
    try {
      const { data } = await api.get(`/team/${memberId}/workload`);
      setMemberTasks(data);
    } catch {
      setMemberTasks([]);
    }
    setTasksLoading(false);
  };

  const selectedMemberData = members.find((m) => m.id === selectedMember);

  return (
    <AppShell title="Team">
      <div className={styles.page}>
        <div className={styles.header}>
          <h2 className={styles.title}>Team Members</h2>
          <span className={styles.count}>{members.length} members</span>
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : (
          <div className={styles.grid}>
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={() => handleMemberClick(member.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={selectedMemberData ? `${selectedMemberData.name}'s Tasks` : 'Tasks'}
        size="md"
      >
        {tasksLoading ? (
          <div className={styles.loading}><Spinner /></div>
        ) : (
          <div className={styles.taskList}>
            {memberTasks.length === 0 ? (
              <p className={styles.empty}>No active tasks</p>
            ) : (
              memberTasks.map((task) => (
                <div key={task._id} className={styles.taskItem}>
                  <div className={styles.taskInfo}>
                    <span className={styles.taskTitle}>{task.title}</span>
                    <span className={styles.taskProject}>
                      {typeof task.project === 'object' ? task.project.title : ''}
                    </span>
                  </div>
                  <div className={styles.taskBadges}>
                    <Badge variant="primary">{formatStatus(task.status)}</Badge>
                    <Badge variant="warning">{task.priority}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
