'use client';
import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';

export function useUnreadTitle() {
  const conversations = useChatStore((s) => s.conversations);
  useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    document.title = total > 0 ? `(${total}) Sonatek` : 'Sonatek';
    return () => { document.title = 'Sonatek'; };
  }, [conversations]);
}
