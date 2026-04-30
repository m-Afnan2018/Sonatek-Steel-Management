'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import MessageBubble from '../MessageBubble/MessageBubble';
import MessageInput from '../MessageInput/MessageInput';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import type { ChatMessage, Conversation } from '@/store/chatStore';
import styles from './ChatWindow.module.css';

interface Props {
  conversation: Conversation;
  currentUserId: string;
}

export default function ChatWindow({ conversation, currentUserId }: Props) {
  const { messages, onlineUsers, typingUsers } = useChatStore();
  const { fetchMessages, sendMessage, toggleReaction, sendTyping } = useChat();

  const convId   = conversation._id;
  const convMsgs = messages[convId] ?? [];

  const [loading, setLoading]   = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [replyTo, setReplyTo]   = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Derive typing names early so effects below can read them
  const typingSet   = typingUsers[convId];
  const typingList  = typingSet ? Array.from(typingSet) : [];
  const typingNames = typingList
    .map((uid) => conversation.participants.find((p) => (p._id || p.id) === uid)?.name)
    .filter(Boolean);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    fetchMessages(convId).then((msgs) => {
      setLoading(false);
      setHasMore(msgs.length === 30);
    });
  }, [convId]);

  const isAtBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Scroll to bottom on new messages
  // Always scroll if the last message is ours (just sent); otherwise only if near bottom
  useEffect(() => {
    const last = convMsgs[convMsgs.length - 1];
    const isMine = last && ((last.sender as any)?._id || (last.sender as any)?.id) === currentUserId;
    if (isMine || isAtBottom()) scrollToBottom();
  }, [convMsgs.length]);

  // Scroll to bottom when typing indicator appears — only if already near bottom
  useEffect(() => {
    if (typingNames.length > 0 && isAtBottom()) scrollToBottom();
  }, [typingNames.length]);

  // Infinite scroll upward
  const handleScroll = useCallback(async () => {
    const el = listRef.current;
    if (!el || loadingRef.current || !hasMore || convMsgs.length === 0) return;
    if (el.scrollTop > 120) return;

    loadingRef.current = true;
    const prevHeight = el.scrollHeight;
    const oldest = convMsgs[0];
    const newMsgs = await fetchMessages(convId, oldest._id);
    setHasMore(newMsgs.length === 30);
    // Restore scroll position after prepend
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevHeight;
    });
    loadingRef.current = false;
  }, [convId, convMsgs, hasMore, fetchMessages]);

  // Determine if group (show sender names)
  const isGroup = conversation.type === 'group' || conversation.type === 'department';

  // Online status for direct chats
  const otherUser = !isGroup
    ? conversation.participants.find((p) => (p._id || p.id) !== currentUserId)
    : null;
  const isOnline = otherUser
    ? onlineUsers.has((otherUser._id || otherUser.id) ?? '')
    : false;

  const handleSend = useCallback((content: string, replyId?: string) => {
    sendMessage(convId, content, replyId);
  }, [convId, sendMessage]);

  const handleTyping = useCallback((isTyping: boolean) => {
    sendTyping(convId, isTyping);
  }, [convId, sendTyping]);

  // Group messages by date
  const grouped: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of convMsgs) {
    const date = new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!grouped.length || grouped[grouped.length - 1].date !== date) {
      grouped.push({ date, messages: [msg] });
    } else {
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  const convName = conversation.name ||
    conversation.participants.find((p) => (p._id || p.id) !== currentUserId)?.name ||
    'Chat';

  return (
    <div className={styles.window}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.headerAvatar}>
            {conversation.avatar ? (
              <img src={conversation.avatar} alt={convName} className={styles.groupAvatarImg} />
            ) : (
              <Avatar name={convName} size="md" />
            )}
            {!isGroup && isOnline && <span className={styles.onlineDot} />}
          </div>
          <div className={styles.headerMeta}>
            <p className={styles.headerName}>{convName}</p>
            <p className={styles.headerSub}>
              {isGroup
                ? `${conversation.participants.length} members`
                : isOnline
                  ? <span className={styles.headerOnline}>Online</span>
                  : 'Offline'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messageList} ref={listRef} onScroll={handleScroll}>
        {loading && (
          <div className={styles.loadingCenter}><Spinner size="md" /></div>
        )}
        {!loading && !hasMore && convMsgs.length > 0 && (
          <p className={styles.beginningNote}>— Beginning of conversation —</p>
        )}
        {grouped.map((group) => (
          <div key={group.date}>
            <div className={styles.dateSep}><span>{group.date}</span></div>
            {group.messages.map((msg) => (
              <MessageBubble
                key={msg._id}
                msg={msg}
                currentUserId={currentUserId}
                showSender={isGroup}
                onReply={setReplyTo}
                onReact={toggleReaction}
              />
            ))}
          </div>
        ))}
        {convMsgs.length === 0 && !loading && (
          <div className={styles.emptyChat}>
            <p>No messages yet. Say hello! 👋</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Typing indicator — sits between message list and input, always visible */}
      {typingNames.length > 0 && (
        <div className={styles.typingIndicator}>
          <div className={styles.typingBubble}>
            <span className={styles.typingDots}><span/><span/><span/></span>
          </div>
          <span className={styles.typingText}>
            {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing
          </span>
        </div>
      )}

      {/* Input */}
      <MessageInput
        conversationId={convId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSend={handleSend}
        onTyping={handleTyping}
      />
    </div>
  );
}
