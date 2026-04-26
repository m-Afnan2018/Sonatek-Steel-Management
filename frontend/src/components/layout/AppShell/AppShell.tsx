'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import styles from './AppShell.module.css';

const SIDEBAR_KEY = 'tracksy_sidebar_collapsed';

interface AppShellProps {
  children: ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);          // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop rail
  const { status, enable } = usePushSubscription();

  // Read persisted preference after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    if (localStorage.getItem(SIDEBAR_KEY) === 'true') {
      setSidebarCollapsed(true);
    }
  }, []);

  // Keep CSS variable in sync so Topbar and main shift together
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--current-sidebar-width',
      sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
    );
  }, [sidebarCollapsed]);

  // Auto-subscribe once we know the user hasn't explicitly blocked
  useEffect(() => {
    if (status === 'not_granted') enable();
  }, [status, enable]);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} title={title} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
