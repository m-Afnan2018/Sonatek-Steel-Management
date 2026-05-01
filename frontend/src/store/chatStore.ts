import { create } from 'zustand';

export interface ChatUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  lastSeen?: string;
}

export interface MessageAttachment {
  name: string;
  url: string;
  type: 'image' | 'file' | 'audio';
  size?: number;
}

export interface Reaction {
  emoji: string;
  users: ChatUser[];
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: ChatUser;
  type: 'text' | 'image' | 'file' | 'audio' | 'system';
  content: string;
  attachments: MessageAttachment[];
  replyTo?: ChatMessage;
  reactions: Reaction[];
  seenBy: { user: string; seenAt: string }[];
  isEdited: boolean;
  editedAt?: string;
  deletedForEveryone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  type: 'direct' | 'group' | 'department';
  name?: string;
  description?: string;
  avatar?: string;
  participants: ChatUser[];
  admins: ChatUser[];
  department?: string;
  createdBy: string;
  lastMessage?: ChatMessage;
  lastActivity: string;
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  pinnedMessages?: Array<{ _id: string; content: string; sender: { name: string } }>;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;       // conversationId -> messages
  onlineUsers: Set<string>;
  typingUsers: Record<string, Set<string>>;      // conversationId -> Set<userId>
  initialUnread: Record<string, number>;         // convId -> unread count at open time

  setConversations: (convs: Conversation[]) => void;
  upsertConversation: (conv: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, msgs: ChatMessage[]) => void;
  prependMessages: (conversationId: string, msgs: ChatMessage[]) => void;
  appendMessage: (conversationId: string, msg: ChatMessage) => void;
  updateMessage: (conversationId: string, msg: ChatMessage) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setInitialUnread: (convId: string, count: number) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  savedMessageIds: Set<string>;
  setSavedMessageIds: (ids: string[]) => void;
  addSavedMessageId: (id: string) => void;
  removeSavedMessageId: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations:        [],
  activeConversationId: null,
  messages:             {},
  onlineUsers:          new Set(),
  typingUsers:          {},
  initialUnread:        {},
  savedMessageIds:      new Set(),

  setConversations: (convs) => set({ conversations: convs }),

  upsertConversation: (conv) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c._id === conv._id);
      if (idx === -1) return { conversations: [conv, ...s.conversations] };
      const next = [...s.conversations];
      next[idx] = conv;
      return { conversations: next };
    }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),

  prependMessages: (conversationId, msgs) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...msgs, ...(s.messages[conversationId] ?? [])],
      },
    })),

  appendMessage: (conversationId, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), msg],
      },
    })),

  updateMessage: (conversationId, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
          m._id === msg._id ? msg : m,
        ),
      },
    })),

  removeMessage: (conversationId, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).filter(
          (m) => m._id !== messageId,
        ),
      },
    })),

  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),

  setInitialUnread: (convId, count) =>
    set((s) => ({ initialUnread: { ...s.initialUnread, [convId]: count } })),

  setUserOnline: (userId) =>
    set((s) => {
      const next = new Set(s.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),

  setUserOffline: (userId) =>
    set((s) => {
      const next = new Set(s.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  setTyping: (conversationId, userId, isTyping) =>
    set((s) => {
      const current = s.typingUsers[conversationId] ?? new Set<string>();
      const next = new Set(current);
      if (isTyping) next.add(userId); else next.delete(userId);
      return { typingUsers: { ...s.typingUsers, [conversationId]: next } };
    }),

  incrementUnread: (conversationId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
      ),
    })),

  setSavedMessageIds: (ids) =>
    set({ savedMessageIds: new Set(ids) }),

  addSavedMessageId: (id) =>
    set((s) => {
      const next = new Set(s.savedMessageIds);
      next.add(id);
      return { savedMessageIds: next };
    }),

  removeSavedMessageId: (id) =>
    set((s) => {
      const next = new Set(s.savedMessageIds);
      next.delete(id);
      return { savedMessageIds: next };
    }),

  clearUnread: (conversationId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    })),
}));
