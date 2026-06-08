'use client';

import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types';
import styles from './ActivityFeed.module.css';

interface ActivityFeedProps {
  notifications: Notification[];
}

const typeIcons: Record<string, string> = {
  task_assigned: '📋',
  comment_mention: '💬',
  deadline_reminder: '⏰',
  status_change: '🔄',
};

export default function ActivityFeed({ notifications }: ActivityFeedProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Recent Activity</h3>
      <div className={styles.list}>
        {notifications.length === 0 ? (
          <p className={styles.empty}>No recent activity</p>
        ) : (
          notifications.slice(0, 8).map((n) => (
            <div key={n._id} className={styles.item}>
              <span className={styles.icon}>{typeIcons[n.type] || '📌'}</span>
              <div className={styles.content}>
                <p className={styles.message}>{n.message}</p>
                <span className={styles.time}>{timeAgo(n.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
