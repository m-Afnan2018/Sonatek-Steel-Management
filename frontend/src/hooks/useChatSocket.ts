'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import type { ChatMessage, Conversation } from '@/store/chatStore';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

let globalSocket: Socket | null = null;

export function useChatSocket() {
  const token   = useAuthStore((s) => s.accessToken);
  const userId  = useAuthStore((s) => s.user?.id);
  const socketRef = useRef<Socket | null>(null);

  const {
    appendMessage, updateMessage, setOnlineUsers, setUserOnline, setUserOffline,
    setTyping, incrementUnread, clearUnread,
    upsertConversation,
  } = useChatStore();

  useEffect(() => {
    if (!token || !userId) return;
    if (globalSocket) {
      socketRef.current = globalSocket;
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    globalSocket = socket;
    socketRef.current = socket;

    socket.on('new_message', (msg: ChatMessage) => {
      appendMessage(msg.conversation, msg);
      const { activeConversationId: activeId } = useChatStore.getState();
      if (msg.conversation !== activeId) {
        incrementUnread(msg.conversation);
      }
    });

    socket.on('message_updated', (msg: ChatMessage) => {
      updateMessage(msg.conversation, msg);
    });

    socket.on('online_users', ({ userIds }: { userIds: string[] }) => setOnlineUsers(userIds));
    socket.on('user_online',  ({ userId: uid }: { userId: string }) => setUserOnline(uid));
    socket.on('user_offline', ({ userId: uid }: { userId: string; lastSeen: string }) => setUserOffline(uid));

    socket.on('user_typing', ({ userId: uid, conversationId }: { userId: string; userName: string; conversationId: string }) => {
      setTyping(conversationId, uid, true);
    });

    socket.on('user_stopped_typing', ({ userId: uid, conversationId }: { userId: string; conversationId: string }) => {
      setTyping(conversationId, uid, false);
    });

    socket.on('messages_seen', ({ conversationId, userId: seenByUserId }: { conversationId: string; userId: string; seenAt: string }) => {
      if (seenByUserId === userId) clearUnread(conversationId);
    });

    socket.on('conversation_updated', (conv: Conversation) => {
      upsertConversation(conv);
    });

    return () => {
      // Don't disconnect on component unmount — keep alive for the session
    };
  }, [token, userId]);

  return socketRef.current ?? globalSocket;
}

export function getSocket(): Socket | null {
  return globalSocket;
}
