'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import ConversationSidebar from '@/components/chat/ConversationSidebar/ConversationSidebar';
import ChatWindow from '@/components/chat/ChatWindow/ChatWindow';
import SavedMessagesPanel from '@/components/chat/SavedMessagesPanel/SavedMessagesPanel';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import styles from './chat.module.css';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  useChatSocket();

  const currentUser = useAuthStore((s) => s.user);
  const { conversations, activeConversationId } = useChatStore();
  const { fetchConversations, selectConversation } = useChat();

  // Mobile: 'sidebar' | 'chat'
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const activeConversation = conversations.find((c) => c._id === activeConversationId) ?? null;

  const handleSelect = (convId: string) => {
    selectConversation(convId);
    setMobileView('chat');
  };

  const handleBack = () => {
    setMobileView('sidebar');
  };

  const handleNavigateToConv = (convId: string) => {
    selectConversation(convId);
    setMobileView('chat');
  };

  return (
    <AppShell title="Chat">
      <div className={styles.layout}>
        {/* Sidebar — hidden on mobile when chat is open */}
        <div className={`${styles.sidebarPanel} ${mobileView === 'chat' ? styles.sidebarHidden : ''}`} style={{ position: 'relative' }}>
          {showSaved && (
            <SavedMessagesPanel
              onClose={() => setShowSaved(false)}
              onNavigate={handleNavigateToConv}
            />
          )}
          <ConversationSidebar
            currentUserId={currentUser?.id ?? ''}
            onSelect={handleSelect}
            onOpenSaved={() => setShowSaved((s) => !s)}
          />
        </div>

        {/* Main — hidden on mobile when sidebar is shown */}
        <div className={`${styles.mainPanel} ${mobileView === 'sidebar' ? styles.mainHidden : ''}`}>
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              currentUserId={currentUser?.id ?? ''}
              onBack={handleBack}
            />
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <MessageSquare size={56} strokeWidth={1.2} opacity={0.3} />
              </div>
              <h2 className={styles.emptyTitle}>Select a conversation</h2>
              <p className={styles.emptyText}>
                Choose a conversation from the sidebar or start a new one.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
