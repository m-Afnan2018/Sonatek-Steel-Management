'use client';

import { useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import ConversationSidebar from '@/components/chat/ConversationSidebar/ConversationSidebar';
import ChatWindow from '@/components/chat/ChatWindow/ChatWindow';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import styles from './chat.module.css';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  useChatSocket(); // establish socket connection

  const currentUser = useAuthStore((s) => s.user);
  const { conversations, activeConversationId } = useChatStore();
  const { fetchConversations } = useChat();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const activeConversation = conversations.find((c) => c._id === activeConversationId) ?? null;

  return (
    <AppShell title="Chat">
      <div className={styles.layout}>
        <ConversationSidebar currentUserId={currentUser?.id ?? ''} />

        <div className={styles.main}>
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              currentUserId={currentUser?.id ?? ''}
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
