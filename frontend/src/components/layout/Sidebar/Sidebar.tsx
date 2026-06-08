'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import styles from './Sidebar.module.css';
import Image from 'next/image'
import image from '@/assets/images/logo.png'
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  Building2,
  FileText,
  MessageSquare,
  BarChart3,
  Settings,
  Briefcase,
  GanttChart,
  UserPlus,
  ChevronLeft,
} from 'lucide-react';

const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard size={20} />,
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: <CheckSquare size={20} />,
  },
  {
    label: 'Attendance',
    href: '/attendance',
    icon: <Calendar size={20} />,
  },
  {
    label: 'Team Workload',
    href: '/team',
    icon: <Users size={20} />,
  },
  {
    label: 'Departments',
    href: '/departments',
    icon: <Building2 size={20} />,
  },
  {
    label: 'Notes',
    href: '/notes',
    icon: <FileText size={20} />,
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: <MessageSquare size={20} />,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: <BarChart3 size={20} />,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings size={20} />,
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  const isAdmin = user?.role === 'admin';
  const totalUnread = useChatStore((s) =>
    s.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
  );

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={cn(styles.sidebar, isOpen && styles.open, collapsed && styles.collapsed)}>

        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Image src={image.src} width={25} height={25} alt="logo" />
          </div>
          <div className={styles.logoText}>
            <h1 className={styles.logoName}>Sonatek</h1>
            <p className={styles.logoSub}>Task Manager</p>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-label={item.label}
              className={cn(
                styles.navItem,
                (pathname === item.href || (item.href !== '/tasks' && pathname.startsWith(item.href + '/'))) && styles.active
              )}
              onClick={onClose}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.href === '/chat' && totalUnread > 0 && (
                <span className={styles.navBadge}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </Link>
          ))}

          {isManagerOrAdmin && (
            <>
              <div className={styles.navDivider} />
              <Link
                href="/team/resources"
                data-label="Resources"
                className={cn(styles.navItem, pathname === '/team/resources' && styles.active)}
                onClick={onClose}
              >
                <span className={styles.navIcon}>
                  <Briefcase size={20} />
                </span>
                <span className={styles.navLabel}>Resources</span>
              </Link>
              <Link
                href="/attendance/team"
                data-label="Team Attendance"
                className={cn(styles.navItem, pathname === '/attendance/team' && styles.active)}
                onClick={onClose}
              >
                <span className={styles.navIcon}>
                  <Users size={20} />
                </span>
                <span className={styles.navLabel}>Team Attendance</span>
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <div className={styles.navDivider} />
              <Link
                href="/team/timeline"
                data-label="Users Timeline"
                className={cn(styles.navItem, pathname === '/team/timeline' && styles.active)}
                onClick={onClose}
              >
                <span className={styles.navIcon}>
                  <GanttChart size={20} />
                </span>
                <span className={styles.navLabel}>Users Timeline</span>
              </Link>
              <Link
                href="/tasks/timeline"
                data-label="Task Timeline"
                className={cn(styles.navItem, pathname === '/tasks/timeline' && styles.active)}
                onClick={onClose}
              >
                <span className={styles.navIcon}>
                  <GanttChart size={20} />
                </span>
                <span className={styles.navLabel}>Task Timeline</span>
              </Link>
              <Link
                href="/admin/users"
                data-label="Admin: Users"
                className={cn(styles.navItem, pathname === '/admin/users' && styles.active)}
                onClick={onClose}
              >
                <span className={styles.navIcon}>
                  <UserPlus size={20} />
                </span>
                <span className={styles.navLabel}>Admin: Users</span>
              </Link>
            </>
          )}
        </nav>

        {/* Footer: user info + collapse toggle */}
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            {user?.avatar ? (
              <img
                src={`${STATIC_BASE}${user.avatar}`}
                alt={user.name || 'User'}
                className={styles.userAvatarImg}
              />
            ) : (
              <div className={styles.userAvatar}>
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user?.name || 'User'}</span>
              <span className={styles.userRole}>{user?.role || 'member'}</span>
            </div>
          </div>

          {/* Desktop collapse toggle — hidden on mobile */}
          <button
            className={styles.collapseBtn}
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              size={16}
              className={cn(styles.collapseBtnIcon, collapsed && styles.collapseBtnIconFlipped)}
            />
          </button>
        </div>
      </aside>
    </>
  );
}
