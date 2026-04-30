'use client';

import { useState, useMemo } from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import NewChatModal from '../NewChatModal/NewChatModal';
import type { Conversation } from '@/store/chatStore';
import styles from './ConversationSidebar.module.css';
import { Building2, MessageSquarePlus, Search, BellOff } from 'lucide-react';

type Tab = 'all' | 'direct' | 'group' | 'department';

interface Props {
  currentUserId: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConvItem({ conv, isActive, currentUserId, onClick }: {
  conv: Conversation;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
}) {
  const { onlineUsers } = useChatStore();

  const isGroup = conv.type !== 'direct';
  const other = !isGroup
    ? conv.participants.find((p) => (p._id || p.id) !== currentUserId)
    : null;
  const displayName = isGroup
    ? conv.name || 'Group'
    : other?.name || 'Chat';
  const isOnline = other ? onlineUsers.has((other._id || other.id) ?? '') : false;

  const lastMsg = conv.lastMessage;
  const preview = lastMsg
    ? lastMsg.deletedForEveryone
      ? '🚫 Message deleted'
      : lastMsg.type !== 'text'
      ? `📎 ${lastMsg.type}`
      : lastMsg.content?.slice(0, 40) || ''
    : 'No messages yet';

  return (
    <button className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`} onClick={onClick}>
      <div className={styles.avatarWrap}>
        <Avatar name={displayName} size="md" />
        {!isGroup && isOnline && <span className={styles.onlineDot} />}
        {isGroup && conv.type === 'department' && (
          <span className={styles.deptBadge} title="Department group">
            <Building2 size={9} strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className={styles.convBody}>
        <div className={styles.convTop}>
          <span className={styles.convName}>{displayName}</span>
          {lastMsg && <span className={styles.convTime}>{formatTime(conv.lastActivity)}</span>}
        </div>
        <div className={styles.convBottom}>
          <span className={styles.convPreview}>{preview}</span>
          {conv.unreadCount > 0 && (
            <span className={styles.unreadBadge}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>
          )}
          {conv.isMuted && (
            <BellOff size={10} className={styles.mutedIcon} />
          )}
        </div>
      </div>
    </button>
  );
}

export default function ConversationSidebar({ currentUserId }: Props) {
  const { conversations, activeConversationId } = useChatStore();
  const { selectConversation } = useChat();

  const [tab, setTab]           = useState<Tab>('all');
  const [search, setSearch]     = useState('');
  const [showNew, setShowNew]   = useState(false);

  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + c.unreadCount, 0),
    [conversations],
  );

  const filtered = useMemo(() => {
    let list = conversations.filter((c) => {
      if (tab === 'direct')     return c.type === 'direct';
      if (tab === 'group')      return c.type === 'group';
      if (tab === 'department') return c.type === 'department';
      return true;
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const name = c.name || c.participants.find((p) => (p._id || p.id) !== currentUserId)?.name || '';
        return name.toLowerCase().includes(q);
      });
    }

    // Pinned first, then by lastActivity
    return list.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });
  }, [conversations, tab, search, currentUserId]);

  return (
    <div className={styles.sidebar}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>
          <span>Chats</span>
          {totalUnread > 0 && <span className={styles.totalBadge}>{totalUnread}</span>}
        </div>
        <button className={styles.newBtn} onClick={() => setShowNew(true)} title="New chat">
          <MessageSquarePlus size={18} />
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <div className={styles.searchInner}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.search}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['all', 'direct', 'group', 'department'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : t === 'direct' ? 'DM' : t === 'group' ? 'Groups' : 'Depts'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <p>{search ? 'No results' : 'No conversations yet'}</p>
            {!search && <button className={styles.emptyNew} onClick={() => setShowNew(true)}>Start a conversation</button>}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConvItem
              key={conv._id}
              conv={conv}
              isActive={conv._id === activeConversationId}
              currentUserId={currentUserId}
              onClick={() => selectConversation(conv._id)}
            />
          ))
        )}
      </div>

      <NewChatModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
