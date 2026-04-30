'use client';

import { useCallback } from 'react';
import api from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { getSocket } from './useChatSocket';
import type { Conversation, ChatMessage } from '@/store/chatStore';

export function useChat() {
  const {
    conversations, setConversations, upsertConversation,
    messages, setMessages, prependMessages,
    activeConversationId, setActiveConversation,
    clearUnread,
  } = useChatStore();

  // ── Conversations ─────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    const { data } = await api.get<Conversation[]>('/chat');
    setConversations(
      data.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      }),
    );
    return data;
  }, [setConversations]);

  const openDirect = useCallback(async (targetUserId: string) => {
    const { data } = await api.post<Conversation>('/chat/direct', { targetUserId });
    upsertConversation(data);
    setActiveConversation(data._id);
    return data;
  }, [upsertConversation, setActiveConversation]);

  const createGroup = useCallback(async (name: string, memberIds: string[]) => {
    const { data } = await api.post<Conversation>('/chat/group', { name, memberIds });
    upsertConversation(data);
    setActiveConversation(data._id);
    return data;
  }, [upsertConversation, setActiveConversation]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversation(id);
    clearUnread(id);
    getSocket()?.emit('mark_seen', { conversationId: id });
    api.post(`/chat/${id}/seen`).catch(() => {});
  }, [setActiveConversation, clearUnread]);

  const updateConversationSettings = useCallback(async (
    id: string,
    patch: { isMuted?: boolean; isPinned?: boolean; isArchived?: boolean },
  ) => {
    await api.patch(`/chat/${id}/settings`, patch);
    await fetchConversations();
  }, [fetchConversations]);

  const leaveConversation = useCallback(async (id: string) => {
    await api.post(`/chat/${id}/leave`);
    setConversations(conversations.filter((c) => c._id !== id));
    if (activeConversationId === id) setActiveConversation(null);
  }, [conversations, activeConversationId, setConversations, setActiveConversation]);

  // ── Messages ──────────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (conversationId: string, before?: string) => {
    const params: Record<string, string> = { limit: '30' };
    if (before) params.before = before;
    const { data } = await api.get<ChatMessage[]>(`/chat/${conversationId}/messages`, { params });
    if (before) {
      prependMessages(conversationId, data);
    } else {
      setMessages(conversationId, data);
    }
    return data;
  }, [setMessages, prependMessages]);

  const sendMessage = useCallback((
    conversationId: string,
    content: string,
    replyTo?: string,
    attachments?: object[],
  ) => {
    // Send via Socket.io for instant delivery
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('send_message', { conversationId, content, replyTo, attachments });
    } else {
      // Fallback to REST if socket not connected
      api.post(`/chat/${conversationId}/messages`, { content, replyTo, attachments })
        .catch(console.error);
    }
  }, []);

  const editMessage = useCallback(async (messageId: string, content: string) => {
    const { data } = await api.patch<ChatMessage>(`/chat/messages/${messageId}`, { content });
    return data;
  }, []);

  const deleteMessage = useCallback(async (messageId: string, forEveryone = false) => {
    await api.delete(`/chat/messages/${messageId}?forEveryone=${forEveryone}`);
  }, []);

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    getSocket()?.emit('add_reaction', { messageId, emoji });
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit(isTyping ? 'typing_start' : 'typing_stop', { conversationId });
  }, []);

  const addMembers = useCallback(async (conversationId: string, memberIds: string[]) => {
    const { data } = await api.post<Conversation>(`/chat/${conversationId}/members`, { memberIds });
    upsertConversation(data);
    return data;
  }, [upsertConversation]);

  const removeMember = useCallback(async (conversationId: string, userId: string) => {
    await api.delete(`/chat/${conversationId}/members/${userId}`);
    await fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    messages,
    activeConversationId,
    fetchConversations,
    openDirect,
    createGroup,
    selectConversation,
    updateConversationSettings,
    leaveConversation,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    sendTyping,
    addMembers,
    removeMember,
  };
}
