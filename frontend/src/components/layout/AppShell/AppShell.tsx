'use client';

import { useState, ReactNode } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useEffect } from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { status, enable } = usePushSubscription();

  // Auto-subscribe once we know the user hasn't explicitly blocked
  useEffect(() => {
    if (status === 'not_granted') enable();
  }, [status, enable]);

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} title={title} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
