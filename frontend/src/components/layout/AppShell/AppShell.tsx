'use client';

import { useState, useEffect, ReactNode } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useSidebarStore } from '@/store/sidebarStore';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const { collapsed, toggle } = useSidebarStore();
  const { status, enable } = usePushSubscription();

  useEffect(() => {
    if (status === 'not_granted') enable();
  }, [status, enable]);

  return (
    <div className={styles.shell}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggle}
      />
      <Topbar
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        title={title}
        sidebarCollapsed={collapsed}
      />
      <main className={`${styles.main} ${collapsed ? styles.mainCollapsed : ''}`}>
        {children}
      </main>
    </div>
  );
}
