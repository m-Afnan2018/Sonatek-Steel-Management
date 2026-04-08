'use client';

import Link from 'next/link';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import Badge from '@/components/ui/Badge/Badge';
import type { Project } from '@/types';
import styles from './ProjectProgress.module.css';

interface ProjectProgressProps {
  projects: Project[];
}

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

export default function ProjectProgress({ projects }: ProjectProgressProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Active Projects</h3>
      <div className={styles.list}>
        {projects.slice(0, 5).map((p) => (
          <Link key={p._id} href={`/projects/${p._id}`} className={styles.item}>
            <div className={styles.top}>
              <span className={styles.name}>{p.title}</span>
              <Badge variant={priorityVariant[p.priority]}>{p.priority}</Badge>
            </div>
            <ProgressBar
              value={p.progress}
              variant={p.progress >= 80 ? 'success' : p.progress >= 40 ? 'primary' : 'warning'}
              showLabel
              size="sm"
            />
            <span className={styles.meta}>
              {p.totalTasks || 0} tasks · Due {new Date(p.endDate).toLocaleDateString()}
            </span>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className={styles.empty}>No active projects</p>
        )}
      </div>
    </div>
  );
}
