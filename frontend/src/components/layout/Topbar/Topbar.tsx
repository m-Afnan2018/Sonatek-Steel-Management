'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useThemeStore } from '@/store/themeStore';
import { useNotifications } from '@/hooks/useNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { timeAgo } from '@/lib/utils';
import styles from './Topbar.module.css';

interface TopbarProps {
  onMenuToggle: () => void;
  title?: string;
  sidebarCollapsed?: boolean;
}

export default function Topbar({ onMenuToggle, title, sidebarCollapsed }: TopbarProps) {
  const { logout, user } = useAuth();
  const { theme, toggle } = useThemeStore();
  const { notifications, unreadCount, markAllRead, markOneRead, clearOne, clearAll } = useNotifications();
  const { status: pushStatus } = usePushSubscription();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={`${styles.topbar} ${sidebarCollapsed ? styles.topbarCollapsed : ''}`}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Toggle menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {title && <h2 className={styles.title}>{title}</h2>}
      </div>

      <div className={styles.right}>
        {/* Theme toggle */}
        <button className={styles.iconBtn} onClick={toggle} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>

        {/* Notifications */}
        <div className={styles.notifWrapper} ref={notifRef}>
          <button
            className={styles.iconBtn}
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <div className={styles.notifHeaderTitle}>
                  <span>Notifications</span>
                  <span
                    className={styles.pushStatusPill}
                    style={{
                      background: pushStatus === 'subscribed'     ? 'var(--success-light)' :
                                  pushStatus === 'denied'         ? 'var(--danger-light)'  :
                                  pushStatus === 'sw_unavailable' ? 'var(--danger-light)'  :
                                  pushStatus === 'loading'        ? 'var(--border)'        :
                                  pushStatus === 'unsupported'    ? 'var(--border)'        :
                                  pushStatus === 'paused'         ? 'var(--border)'        :
                                                                    'var(--warning-light)',
                      color:      pushStatus === 'subscribed'     ? 'var(--success)'       :
                                  pushStatus === 'denied'         ? 'var(--danger)'        :
                                  pushStatus === 'sw_unavailable' ? 'var(--danger)'        :
                                  pushStatus === 'loading'        ? 'var(--text-muted)'    :
                                  pushStatus === 'unsupported'    ? 'var(--text-muted)'    :
                                  pushStatus === 'paused'         ? 'var(--text-muted)'    :
                                                                    'var(--warning)',
                    }}
                    title={`Push: ${pushStatus}`}
                  >
                    {pushStatus === 'subscribed'     && '● Push on'}
                    {pushStatus === 'paused'         && '○ Push paused'}
                    {pushStatus === 'denied'         && '● Push blocked'}
                    {pushStatus === 'sw_unavailable' && '● SW off'}
                    {pushStatus === 'not_granted'    && '○ Push off'}
                    {pushStatus === 'not_subscribed' && '○ Push off'}
                    {pushStatus === 'loading'        && '· · ·'}
                    {pushStatus === 'unsupported'    && '— Unsupported'}
                  </span>
                </div>
                <div className={styles.notifHeaderActions}>
                  {unreadCount > 0 && (
                    <button className={styles.markRead} onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button className={styles.clearAll} onClick={clearAll} title="Clear all notifications">
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.dropdownList}>
                {notifications.length === 0 ? (
                  <p className={styles.empty}>No notifications</p>
                ) : (
                  notifications.map((n) => {
                    const isLunchAlert = (n as any).type === 'lunch_overtime';
                    const unreadClass = !n.isRead
                      ? isLunchAlert ? styles.unreadLunch : styles.unread
                      : '';
                    return n.link ? (
                      <div key={n._id} className={`${styles.notifItem} ${unreadClass}`}>
                        <Link
                          href={n.link}
                          className={styles.notifBody}
                          onClick={() => { markOneRead(n._id); setShowNotifications(false); }}
                        >
                          {!n.isRead && (
                            <span className={styles.unreadDot}
                              style={isLunchAlert ? { background: 'var(--warning)' } : undefined} />
                          )}
                          <div className={styles.notifContent}>
                            <p className={styles.notifTitle}>{n.title}</p>
                            <p className={styles.notifMsg}>{n.message}</p>
                            <span className={styles.notifTime}>{timeAgo(n.createdAt)}</span>
                          </div>
                        </Link>
                        <button
                          className={styles.clearBtn}
                          onClick={(e) => { e.stopPropagation(); clearOne(n._id); }}
                          title="Clear notification"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ) : (
                      <div
                        key={n._id}
                        className={`${styles.notifItem} ${unreadClass}`}
                      >
                        <div
                          className={styles.notifBody}
                          onClick={() => { if (!n.isRead) markOneRead(n._id); }}
                        >
                          {!n.isRead && (
                            <span className={styles.unreadDot}
                              style={isLunchAlert ? { background: 'var(--warning)' } : undefined} />
                          )}
                          <div className={styles.notifContent}>
                            <p className={styles.notifTitle}>{n.title}</p>
                            <p className={styles.notifMsg}>{n.message}</p>
                            <span className={styles.notifTime}>{timeAgo(n.createdAt)}</span>
                          </div>
                        </div>
                        <button
                          className={styles.clearBtn}
                          onClick={() => clearOne(n._id)}
                          title="Clear notification"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className={styles.userWrapper} ref={userRef}>
          <button
            className={styles.userBtn}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className={styles.avatar}>{user?.name?.charAt(0) || 'U'}</div>
          </button>

          {showUserMenu && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <div>
                  <p style={{ fontWeight: 600 }}>{user?.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</p>
                </div>
              </div>
              <div className={styles.dropdownList}>
                {isAdmin && (
                  <Link href="/admin/users" className={styles.menuItem}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" />
                    </svg>
                    Manage Users
                  </Link>
                )}
                <button className={styles.menuItem} onClick={logout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
