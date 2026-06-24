'use client';

import type { Department, Task } from '@/types';
import styles from './DeptBreakdown.module.css';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

interface Props {
  departments: Department[];
  tasks: Task[];
}

function resolveId(u: { id?: string; _id?: string }): string {
  return u.id || (u as any)._id || '';
}

export default function DeptBreakdown({ departments, tasks }: Props) {
  const router = useRouter();

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>
        <Building2 size={16} />
        Department Overview
      </h3>
      <div className={styles.grid}>
        {departments.length === 0 && (
          <p className={styles.empty}>No departments configured</p>
        )}
        {departments.map((dept) => {
          const memberIds = new Set([
            ...dept.members.map(resolveId),
            ...dept.heads.map(resolveId),
          ]);
          const deptTasks = tasks.filter((t) =>
            t.assignees.some((a) => memberIds.has(resolveId(a as any)))
          );
          const active = deptTasks.filter((t) =>
            ['todo', 'in_progress', 'in_review'].includes(t.status)
          ).length;
          const done = deptTasks.filter((t) => t.status === 'done').length;
          const total = dept.members.length + dept.heads.length;

          return (
            <div
              key={dept._id}
              className={styles.deptCard}
              style={{ borderLeftColor: dept.color }}
              onClick={() => router.push('/departments')}
            >
              <div className={styles.deptHeader}>
                <span className={styles.dot} style={{ background: dept.color }} />
                <span className={styles.deptName}>{dept.name}</span>
              </div>
              <div className={styles.deptStats}>
                <span>{total} {total === 1 ? 'member' : 'members'}</span>
                <span className={styles.active}>{active} active</span>
                <span className={styles.done}>{done} done</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
