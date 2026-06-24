'use client';

import { useState } from 'react';
import type { Department, Task, User } from '@/types';
import styles from './DeptTasksView.module.css';
import Avatar from '@/components/ui/Avatar/Avatar';
import MiniTimer from '../MiniTimer/MiniTimer';
import { Circle, CheckCircle2, ChevronDown, ChevronRight, Loader2, Users } from 'lucide-react';
import { getPriorityColor } from '@/lib/utils';

type Status = Task['status'];
type TimerAction = 'start' | 'pause' | 'resume' | 'hold' | 'finish';

const NEXT_STATUS: Record<Status, Status> = {
  backlog: 'todo',
  todo: 'in_progress',
  in_progress: 'in_review',
  in_review: 'done',
  done: 'done',
};

const STATUS_COLOR: Record<Status, string> = {
  backlog: 'var(--text-muted)',
  todo: 'var(--primary)',
  in_progress: 'var(--warning)',
  in_review: '#7C5CBF',
  done: 'var(--success)',
};

const STATUS_LABEL: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

function resolveId(u: any): string {
  return u?.id || u?._id || (typeof u === 'string' ? u : '') || '';
}

interface Props {
  departments: Department[];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: Status) => Promise<void>;
  patchTimer: (id: string, action: TimerAction) => Promise<Task | null>;
  onTimerUpdate: (updated: Task) => void;
}

export default function DeptTasksView({
  departments,
  tasks,
  onTaskClick,
  onStatusChange,
  patchTimer,
  onTimerUpdate,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(departments.slice(0, 1).map((d) => d._id))
  );
  const [updating, setUpdating] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdvance = async (task: Task) => {
    const next = NEXT_STATUS[task.status];
    if (next === task.status) return;
    setUpdating(task._id);
    try {
      await onStatusChange(task._id, next);
    } finally {
      setUpdating(null);
    }
  };

  if (departments.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.sectionTitle}>Departments</h3>

      {departments.map((dept) => {
        const allMembers: User[] = [];
        const seen = new Set<string>();
        for (const u of [...dept.heads, ...dept.members]) {
          const uid = resolveId(u);
          if (uid && !seen.has(uid)) {
            seen.add(uid);
            allMembers.push(u);
          }
        }

        const memberTaskMap = new Map<string, Task[]>();
        for (const m of allMembers) {
          const uid = resolveId(m);
          memberTaskMap.set(
            uid,
            tasks.filter(
              (t) =>
                t.status !== 'done' &&
                t.assignees.some((a) => resolveId(a) === uid)
            )
          );
        }

        const activeCount = Array.from(memberTaskMap.values()).reduce(
          (s, arr) => s + arr.length,
          0
        );
        const isOpen = expanded.has(dept._id);

        const sortedMembers = [...allMembers].sort(
          (a, b) =>
            (memberTaskMap.get(resolveId(b))?.length ?? 0) -
            (memberTaskMap.get(resolveId(a))?.length ?? 0)
        );

        return (
          <div key={dept._id} className={styles.deptCard}>
            <button
              className={styles.deptHeader}
              onClick={() => toggle(dept._id)}
              aria-expanded={isOpen}
            >
              <span className={styles.deptDot} style={{ background: dept.color }} />
              <span className={styles.deptName}>{dept.name}</span>
              <span className={styles.deptMeta}>
                <Users size={12} />
                {allMembers.length}
              </span>
              {activeCount > 0 && (
                <span className={styles.activeCount}>{activeCount} active</span>
              )}
              {isOpen ? (
                <ChevronDown size={15} className={styles.chevron} />
              ) : (
                <ChevronRight size={15} className={styles.chevron} />
              )}
            </button>

            {isOpen && (
              <div className={styles.deptBody}>
                {allMembers.length === 0 ? (
                  <p className={styles.empty}>No members in this department</p>
                ) : (
                  sortedMembers.map((member) => {
                    const uid = resolveId(member);
                    const memberTasks = memberTaskMap.get(uid) ?? [];

                    return (
                      <div key={uid} className={styles.memberBlock}>
                        <div className={styles.memberHeader}>
                          <Avatar name={member.name} src={(member as any).avatar} size="sm" />
                          <span className={styles.memberName}>{member.name}</span>
                          <span className={styles.taskCount}>
                            {memberTasks.length > 0
                              ? `${memberTasks.length} task${memberTasks.length !== 1 ? 's' : ''}`
                              : 'No active tasks'}
                          </span>
                        </div>

                        {memberTasks.length > 0 && (
                          <div className={styles.taskList}>
                            {memberTasks.map((task) => {
                              const isUpd = updating === task._id;
                              return (
                                <div key={task._id} className={styles.taskRow}>
                                  <button
                                    className={styles.circle}
                                    style={{ color: STATUS_COLOR[task.status] } as React.CSSProperties}
                                    onClick={() => handleAdvance(task)}
                                    disabled={isUpd || task.status === 'done'}
                                    title={
                                      task.status !== 'done'
                                        ? `Move to ${STATUS_LABEL[NEXT_STATUS[task.status]]}`
                                        : 'Done'
                                    }
                                  >
                                    {isUpd ? (
                                      <Loader2 size={15} className={styles.spin} />
                                    ) : task.status === 'done' ? (
                                      <CheckCircle2 size={15} />
                                    ) : (
                                      <Circle size={15} />
                                    )}
                                  </button>

                                  <div
                                    className={styles.taskInfo}
                                    onClick={() => onTaskClick(task)}
                                  >
                                    <p className={styles.taskTitle}>{task.title}</p>
                                    <div className={styles.taskMeta}>
                                      <span
                                        style={{
                                          color: STATUS_COLOR[task.status],
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {STATUS_LABEL[task.status]}
                                      </span>
                                      <span
                                        style={{
                                          color: getPriorityColor(task.priority),
                                          fontSize: '0.7rem',
                                        }}
                                      >
                                        {task.priority}
                                      </span>
                                      {task.dueDate && (
                                        <span className={styles.due}>
                                          {new Date(task.dueDate).toLocaleDateString('en', {
                                            month: 'short',
                                            day: 'numeric',
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <MiniTimer
                                    task={task}
                                    onUpdate={onTimerUpdate}
                                    patchTimer={patchTimer}
                                  />

                                  <ChevronRight
                                    size={13}
                                    className={styles.taskArrow}
                                    onClick={() => onTaskClick(task)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
