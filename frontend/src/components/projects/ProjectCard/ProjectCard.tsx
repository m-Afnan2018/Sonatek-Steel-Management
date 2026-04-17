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

const STATIC_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
).replace(/\/api$/, '');

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
  const thumbSrc = project.thumbnail ? `${STATIC_BASE}${project.thumbnail}` : null;

  return (
    <Link href={`/projects/${project._id}`} className={styles.card}>
      {/* Thumbnail */}
      {thumbSrc ? (
        <div className={styles.thumb}>
          <img src={thumbSrc} alt={project.title} className={styles.thumbImg} />
        </div>
      ) : (
        <div className={styles.thumbPlaceholder}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={styles.thumbIcon}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      )}

      <div className={styles.body}>
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
          {project.endDate && (
            <span className={styles.date}>Due {formatDate(project.endDate)}</span>
          )}
        </div>

        {project.tags.length > 0 && (
          <div className={styles.tags}>
            {project.tags.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
