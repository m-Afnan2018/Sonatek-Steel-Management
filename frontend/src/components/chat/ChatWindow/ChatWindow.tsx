'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import Spinner from '@/components/ui/Spinner/Spinner';
import MessageBubble from '../MessageBubble/MessageBubble';
import MessageInput from '../MessageInput/MessageInput';
import DeleteConfirmModal from '../DeleteConfirmModal/DeleteConfirmModal';
import ConversationInfo from '../ConversationInfo/ConversationInfo';
import ForwardModal from '../ForwardModal/ForwardModal';
import PinnedMessagesBanner from '../PinnedMessagesBanner/PinnedMessagesBanner';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import type { ChatMessage, Conversation } from '@/store/chatStore';
import styles from './ChatWindow.module.css';
import { Search, Info, X, ChevronLeft } from 'lucide-react';

interface Props {
  conversation: Conversation;
  currentUserId: string;
  onBack?: () => void;       // mobile back button
}

interface DeleteState {
  msgId: string;
  forEveryone: boolean;
}

export default function ChatWindow({ conversation, currentUserId, onBack }: Props) {
  const { messages, onlineUsers, typingUsers, updateMessage, removeMessage, initialUnread, savedMessageIds } = useChatStore();
  const { fetchMessages, sendMessage, toggleReaction, sendTyping, editMessage, deleteMessage, pinMessage, saveMsg, unsaveMsg } = useChat();

  const convId   = conversation._id;
  const convMsgs = messages[convId] ?? [];

  const [loading, setLoading]   = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [replyTo, setReplyTo]   = useState<ChatMessage | null>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);
  const listRef       = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const loadingRef    = useRef(false);

  // Ref map for scroll-to by message id
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Header / panel state
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfo, setShowInfo]       = useState(false);

  // Modals
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [forwardMsg, setForwardMsg]   = useState<ChatMessage | null>(null);

  // Typing indicator
  const typingSet   = typingUsers[convId];
  const typingList  = typingSet ? Array.from(typingSet) : [];
  const typingNames = typingList
    .map((uid) => conversation.participants.find((p) => (p._id || p.id) === uid)?.name)
    .filter(Boolean);

  // ── Scroll helpers ──────────────────────────────────────────────────────
  const isAtBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    setShowSearch(false);
    setSearchQuery('');
    setShowInfo(false);

    fetchMessages(convId).then((msgs) => {
      setLoading(false);
      setHasMore(msgs.length === 30);

      // After paint: scroll to first unread OR to bottom
      requestAnimationFrame(() => {
        const unread = useChatStore.getState().initialUnread[convId] ?? 0;
        if (unread > 0 && firstUnreadRef.current) {
          firstUnreadRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        } else {
          bottomRef.current?.scrollIntoView({ behavior: 'instant' });
        }
      });
    });
  }, [convId]);

  // Scroll to bottom on new messages (only if already near bottom / own message)
  useEffect(() => {
    if (loading) return;
    const last = convMsgs[convMsgs.length - 1];
    const isMine = last && ((last.sender as any)?._id || (last.sender as any)?.id) === currentUserId;
    if (isMine || isAtBottom()) scrollToBottom();
  }, [convMsgs.length]);

  // Scroll when typing indicator appears
  useEffect(() => {
    if (typingNames.length > 0 && isAtBottom()) scrollToBottom();
  }, [typingNames.length]);

  // ── Infinite scroll upward ──────────────────────────────────────────────
  const handleScroll = useCallback(async () => {
    const el = listRef.current;
    if (!el || loadingRef.current || !hasMore || convMsgs.length === 0) return;
    if (el.scrollTop > 120) return;

    loadingRef.current = true;
    const prevHeight = el.scrollHeight;
    const oldest = convMsgs[0];
    const newMsgs = await fetchMessages(convId, oldest._id);
    setHasMore(newMsgs.length === 30);
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight - prevHeight;
    });
    loadingRef.current = false;
  }, [convId, convMsgs, hasMore, fetchMessages]);

  // ── Derived state ───────────────────────────────────────────────────────
  const isGroup = conversation.type === 'group' || conversation.type === 'department';
  const otherUser = !isGroup
    ? conversation.participants.find((p) => (p._id || p.id) !== currentUserId)
    : null;
  const isOnline = otherUser ? onlineUsers.has((otherUser._id || otherUser.id) ?? '') : false;
  const lastSeenStr = (!isOnline && otherUser?.lastSeen)
    ? (() => {
        const d = new Date(otherUser.lastSeen as string);
        const diff = Date.now() - d.getTime();
        const mins  = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days  = Math.floor(diff / 86400000);
        if (mins < 1)    return 'just now';
        if (mins < 60)   return `${mins}m ago`;
        if (hours < 24)  return `${hours}h ago`;
        return `${days}d ago`;
      })()
    : null;

  const convName = conversation.name ||
    conversation.participants.find((p) => (p._id || p.id) !== currentUserId)?.name ||
    'Chat';

  // First-unread index (before searching)
  const storedUnread = initialUnread[convId] ?? 0;
  const firstUnreadIdx = storedUnread > 0 ? convMsgs.length - storedUnread : -1;

  // canUnpin: user is admin or direct chat participant
  const isAdmin = conversation.admins?.some((a) => (a._id || (a as any).id) === currentUserId);
  const canUnpin = isAdmin || conversation.type === 'direct';

  // ── Message ref callback ─────────────────────────────────────────────────
  const setMsgRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) msgRefs.current.set(id, el);
    else msgRefs.current.delete(id);
  }, []);

  // ── Message actions ─────────────────────────────────────────────────────

  const handleSend = useCallback((content: string, replyId?: string, attachments?: object[]) => {
    sendMessage(convId, content, replyId, attachments);
  }, [convId, sendMessage]);

  const handleTyping = useCallback((isTyping: boolean) => {
    sendTyping(convId, isTyping);
  }, [convId, sendTyping]);

  // Edit — optimistic first, then REST (REST also triggers socket broadcast)
  const handleEdit = useCallback((updatedMsg: ChatMessage) => {
    // Optimistic update immediately
    updateMessage(convId, { ...updatedMsg, isEdited: true });
    // REST in background (backend emits message_updated socket to all)
    editMessage(updatedMsg._id, updatedMsg.content).catch(console.error);
  }, [convId, editMessage, updateMessage]);

  const handleDeleteRequest = useCallback((msgId: string, forEveryone: boolean) => {
    setDeleteState({ msgId, forEveryone });
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteState) return;
    const { msgId, forEveryone } = deleteState;
    setDeleteState(null);

    if (forEveryone) {
      // Optimistic: mark deleted immediately
      const msg = useChatStore.getState().messages[convId]?.find((m) => m._id === msgId);
      if (msg) updateMessage(convId, { ...msg, deletedForEveryone: true, content: '', attachments: [] });
      // REST in background — backend emits message_deleted socket to all participants
      deleteMessage(msgId, true).catch(console.error);
    } else {
      // Optimistic: remove locally right away
      removeMessage(convId, msgId);
      // REST in background
      deleteMessage(msgId, false).catch(console.error);
    }
  }, [deleteState, convId, deleteMessage, updateMessage, removeMessage]);

  const handleForward = useCallback((msg: ChatMessage) => {
    setForwardMsg(msg);
  }, []);

  const handleForwardSend = useCallback((targetConvId: string, content: string) => {
    sendMessage(targetConvId, `↪ ${content}`);
  }, [sendMessage]);

  // ── Pin handlers ─────────────────────────────────────────────────────────
  const handlePin = useCallback(async (msgId: string, pin: boolean) => {
    try {
      await pinMessage(convId, msgId, pin);
    } catch (err: any) {
      console.error('handlePin:', err);
    }
  }, [convId, pinMessage]);

  // ── Save handlers ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async (msg: ChatMessage) => {
    try {
      await saveMsg(msg);
    } catch (err) {
      console.error('handleSave:', err);
    }
  }, [saveMsg]);

  const handleUnsave = useCallback(async (msgId: string) => {
    try {
      await unsaveMsg(msgId);
    } catch (err) {
      console.error('handleUnsave:', err);
    }
  }, [unsaveMsg]);

  // ── Scroll to pinned message ───────────────────────────────────────────────
  const handleScrollTo = useCallback((msgId: string) => {
    const el = msgRefs.current.get(msgId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ── Unpin handler ─────────────────────────────────────────────────────────
  const handleUnpin = useCallback((msgId: string) => {
    handlePin(msgId, false);
  }, [handlePin]);

  // ── Filtered messages (search) ──────────────────────────────────────────
  const displayMsgs = searchQuery.trim()
    ? convMsgs.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : convMsgs;

  // Group by date
  const grouped: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of displayMsgs) {
    const date = new Date(msg.createdAt).toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric',
    });
    if (!grouped.length || grouped[grouped.length - 1].date !== date) {
      grouped.push({ date, messages: [msg] });
    } else {
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  // Pinned messages from conversation
  const pinnedMessages = conversation.pinnedMessages ?? [];

  // ── Render ──────────────────────────────────────────────────────────────
  let msgCounter = 0; // tracks global index across groups for unread divider

  return (
    <div className={`${styles.window} ${showInfo ? styles.windowWithInfo : ''}`}>
      <div className={styles.chatArea}>

        {/* Header */}
        <div className={styles.header}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack} aria-label="Back">
              <ChevronLeft size={22} />
            </button>
          )}
          <div className={styles.headerInfo}>
            <div className={styles.headerAvatar}>
              {conversation.avatar
                ? <img src={conversation.avatar} alt={convName} className={styles.groupAvatarImg} />
                : <Avatar name={convName} size="md" />}
              {!isGroup && isOnline && <span className={styles.onlineDot} />}
            </div>
            <div className={styles.headerMeta}>
              <p className={styles.headerName}>{convName}</p>
              <p className={styles.headerSub}>
                {isGroup
                  ? `${conversation.participants.length} members`
                  : isOnline
                    ? <span className={styles.headerOnline}>Online</span>
                    : lastSeenStr
                      ? <span>last seen {lastSeenStr}</span>
                      : 'Offline'}
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.headerBtn} ${showSearch ? styles.headerBtnActive : ''}`}
              onClick={() => { setShowSearch((s) => !s); setSearchQuery(''); }}
              title="Search messages"
            >
              <Search size={17} />
            </button>
            <button
              className={`${styles.headerBtn} ${showInfo ? styles.headerBtnActive : ''}`}
              onClick={() => setShowInfo((s) => !s)}
              title="Conversation info"
            >
              <Info size={17} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className={styles.searchBar}>
            <Search size={14} className={styles.searchBarIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search messages…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className={styles.searchClearBtn} onClick={() => setSearchQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Pinned messages banner */}
        {pinnedMessages.length > 0 && (
          <PinnedMessagesBanner
            pinnedMessages={pinnedMessages}
            onUnpin={handleUnpin}
            canUnpin={canUnpin}
            onScrollTo={handleScrollTo}
          />
        )}

        {/* Messages */}
        <div className={styles.messageList} ref={listRef} onScroll={handleScroll}>
          {loading && <div className={styles.loadingCenter}><Spinner size="md" /></div>}
          {!loading && !hasMore && convMsgs.length > 0 && (
            <p className={styles.beginningNote}>— Beginning of conversation —</p>
          )}

          {searchQuery && displayMsgs.length === 0 ? (
            <div className={styles.emptyChat}>
              <p>No messages match &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.date}>
                <div className={styles.dateSep}><span>{group.date}</span></div>
                {group.messages.map((msg) => {
                  const idx = msgCounter++;
                  const isFirstUnread = !searchQuery && idx === firstUnreadIdx && storedUnread > 0;
                  const isPinned = pinnedMessages.some(
                    (p) => p._id === msg._id
                  );
                  const isSaved = savedMessageIds.has(msg._id);
                  return (
                    <div key={msg._id} ref={setMsgRef(msg._id)}>
                      {isFirstUnread && (
                        <div ref={firstUnreadRef} className={styles.unreadDivider}>
                          <span>
                            {storedUnread} unread message{storedUnread !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      <MessageBubble
                        msg={msg}
                        currentUserId={currentUserId}
                        showSender={isGroup}
                        conversationId={convId}
                        onReply={setReplyTo}
                        onReact={toggleReaction}
                        onEdit={handleEdit}
                        onDelete={handleDeleteRequest}
                        onForward={handleForward}
                        isPinned={isPinned}
                        onPin={(id) => handlePin(id, !isPinned)}
                        isSaved={isSaved}
                        onSave={(m) => isSaved ? handleUnsave(m._id) : handleSave(m)}
                      />
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {convMsgs.length === 0 && !loading && (
            <div className={styles.emptyChat}><p>No messages yet. Say hello! 👋</p></div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className={styles.typingIndicator}>
            <div className={styles.typingBubble}>
              <span className={styles.typingDots}><span /><span /><span /></span>
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

      {/* Info panel */}
      {showInfo && (
        <ConversationInfo
          conversation={conversation}
          currentUserId={currentUserId}
          onClose={() => setShowInfo(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteState && (
        <DeleteConfirmModal
          forEveryone={deleteState.forEveryone}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteState(null)}
        />
      )}

      {/* Forward modal */}
      {forwardMsg && (
        <ForwardModal
          msg={forwardMsg}
          currentUserId={currentUserId}
          onForward={handleForwardSend}
          onClose={() => setForwardMsg(null)}
        />
      )}
    </div>
  );
}
