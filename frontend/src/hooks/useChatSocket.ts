'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import type { ChatMessage, Conversation } from '@/store/chatStore';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

let globalSocket: Socket | null = null;

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(820, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {}
}

export function useChatSocket() {
  const token   = useAuthStore((s) => s.accessToken);
  const userId  = useAuthStore((s) => s.user?.id);
  const socketRef = useRef<Socket | null>(null);

  const {
    appendMessage, updateMessage, setOnlineUsers, setUserOnline, setUserOffline,
    setTyping, incrementUnread, clearUnread, updateSeenAt,
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
      const senderId = (msg.sender as any)?._id || (msg.sender as any)?.id || '';
      if (msg.conversation !== activeId) {
        incrementUnread(msg.conversation);
        // Play sound for messages from others when not in that conversation
        if (senderId !== userId) playNotificationSound();
      }
    });

    socket.on('message_updated', (msg: ChatMessage) => {
      updateMessage(msg.conversation, msg);
    });

    socket.on('message_deleted', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      const { messages } = useChatStore.getState();
      const msg = messages[conversationId]?.find((m) => m._id === messageId);
      if (msg) {
        useChatStore.getState().updateMessage(conversationId, {
          ...msg,
          deletedForEveryone: true,
          content: '',
          attachments: [],
        });
      }
    });

    socket.on('online_users', ({ userIds }: { userIds: string[] }) => {
      setOnlineUsers(userIds);
      // Initialize saved message IDs now that we're authenticated
      api.get('/chat/saved')
        .then(({ data }) => {
          useChatStore.getState().setSavedMessageIds(
            data.map((s: { messageId: string }) => s.messageId)
          );
        })
        .catch(() => {});
    });
    socket.on('user_online',  ({ userId: uid }: { userId: string }) => setUserOnline(uid));
    socket.on('user_offline', ({ userId: uid, lastSeen }: { userId: string; lastSeen: string }) => {
      setUserOffline(uid);
      // Patch lastSeen into any conversation that has this participant
      if (lastSeen) {
        const { conversations } = useChatStore.getState();
        conversations.forEach((conv) => {
          const p = conv.participants.find((p) => (p._id || p.id) === uid);
          if (p) p.lastSeen = lastSeen;
        });
      }
    });

    socket.on('user_typing', ({ userId: uid, conversationId }: { userId: string; userName: string; conversationId: string }) => {
      setTyping(conversationId, uid, true);
    });

    socket.on('user_stopped_typing', ({ userId: uid, conversationId }: { userId: string; conversationId: string }) => {
      setTyping(conversationId, uid, false);
    });

    socket.on('messages_seen', ({ conversationId, userId: seenByUserId, seenAt }: { conversationId: string; userId: string; seenAt: string }) => {
      // Record when this user last saw the conversation (drives blue ticks on sender's side)
      updateSeenAt(conversationId, seenByUserId, seenAt);
      // If it's the current user who just saw it, clear their unread count
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
