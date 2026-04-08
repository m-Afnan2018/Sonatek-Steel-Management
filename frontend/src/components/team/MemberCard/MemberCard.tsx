'use client';

import Avatar from '@/components/ui/Avatar/Avatar';
import Badge from '@/components/ui/Badge/Badge';
import WorkloadBar from '../WorkloadBar/WorkloadBar';
import type { TeamMember } from '@/types';
import styles from './MemberCard.module.css';

interface MemberCardProps {
  member: TeamMember;
  onClick?: () => void;
}

const roleVariant: Record<string, 'primary' | 'success' | 'warning' | 'default'> = {
  admin: 'danger' as 'primary',
  manager: 'warning',
  member: 'primary',
  viewer: 'default',
};

export default function MemberCard({ member, onClick }: MemberCardProps) {
  return (
    <div className={styles.card} onClick={onClick}>
      <Avatar name={member.name} src={member.avatar} size="lg" />
      <div className={styles.info}>
        <h4 className={styles.name}>{member.name}</h4>
        <p className={styles.email}>{member.email}</p>
        <div className={styles.badges}>
          <Badge variant={roleVariant[member.role] || 'default'}>{member.role}</Badge>
          {member.department && (
            <Badge variant="default">{member.department}</Badge>
          )}
        </div>
      </div>
      <div className={styles.workload}>
        <span className={styles.taskCount}>{member.activeTasks} active tasks</span>
        <WorkloadBar tasks={member.activeTasks} max={10} />
      </div>
    </div>
  );
}
