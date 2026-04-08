'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge/Badge';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import Avatar from '@/components/ui/Avatar/Avatar';
import { formatDate, formatStatus } from '@/lib/utils';
import type { Project } from '@/types';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  project: Project;
}

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

const statusVariant = {
  active: 'success' as const,
  planning: 'primary' as const,
  on_hold: 'warning' as const,
  completed: 'success' as const,
  archived: 'default' as const,
};

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project._id}`} className={styles.card}>
      <div className={styles.header}>
        <div className={styles.badges}>
          <Badge variant={statusVariant[project.status]}>{formatStatus(project.status)}</Badge>
          <Badge variant={priorityVariant[project.priority]}>{project.priority}</Badge>
        </div>
      </div>

      <h3 className={styles.title}>{project.title}</h3>
      <p className={styles.desc}>{project.description}</p>

      <div className={styles.progress}>
        <ProgressBar value={project.progress} showLabel size="sm" />
      </div>

      <div className={styles.footer}>
        <div className={styles.avatars}>
          {project.members.slice(0, 3).map((m) => (
            <Avatar key={m.user?.id || m.user?.email} name={m.user?.name || 'U'} size="sm" />
          ))}
          {project.members.length > 3 && (
            <span className={styles.more}>+{project.members.length - 3}</span>
          )}
        </div>
        <span className={styles.date}>Due {formatDate(project.endDate)}</span>
      </div>

      {project.tags.length > 0 && (
        <div className={styles.tags}>
          {project.tags.map((tag) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      )}
    </Link>
  );
}
