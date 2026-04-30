'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useThemeStore } from '@/store/themeStore';
import { useNotifications } from '@/hooks/useNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { timeAgo } from '@/lib/utils';
import styles from './Topbar.module.css';
import { Menu, Sun, Moon, Bell, UserPlus, LogOut, X } from 'lucide-react';

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
          <Menu size={22} />
        </button>
        {title && <h2 className={styles.title}>{title}</h2>}
      </div>

      <div className={styles.right}>
        {/* Theme toggle */}
        <button className={styles.iconBtn} onClick={toggle} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? (
            <Sun size={20} />
          ) : (
            <Moon size={20} />
          )}
        </button>

        {/* Notifications */}
        <div className={styles.notifWrapper} ref={notifRef}>
          <button
            className={styles.iconBtn}
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <Bell size={20} />
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
                          <X size={12} />
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
                          <X size={12} />
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
                    <UserPlus size={16} />
                    Manage Users
                  </Link>
                )}
                <button className={styles.menuItem} onClick={logout}>
                  <LogOut size={16} />
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
