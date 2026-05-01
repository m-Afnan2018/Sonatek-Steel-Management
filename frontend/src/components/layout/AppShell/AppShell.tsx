'use client';

import { useState, useEffect, ReactNode } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import QuickNoteModal from '@/components/ui/QuickNoteModal/QuickNoteModal';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useSidebarStore } from '@/store/sidebarStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useUnreadTitle } from '@/hooks/useUnreadTitle';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const { collapsed, toggle } = useSidebarStore();
  const { status, enable } = usePushSubscription();
  useChatSocket();
  useUnreadTitle();

  useEffect(() => {
    if (status === 'not_granted') enable();
  }, [status, enable]);

  // Global Shift+N shortcut — skip when focus is inside a text field
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.key !== 'N') return;
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = (e.target as HTMLElement).isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) return;
      e.preventDefault();
      setQuickNoteOpen(true);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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

      <QuickNoteModal
        open={quickNoteOpen}
        onClose={() => setQuickNoteOpen(false)}
      />
    </div>
  );
}
