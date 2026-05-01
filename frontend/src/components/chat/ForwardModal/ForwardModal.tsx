'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Search, Check, Forward } from 'lucide-react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useChatStore } from '@/store/chatStore';
import type { ChatMessage, Conversation } from '@/store/chatStore';
import styles from './ForwardModal.module.css';

interface Props {
  msg: ChatMessage;
  currentUserId: string;
  onForward: (targetConvId: string, content: string) => void;
  onClose: () => void;
}

export default function ForwardModal({ msg, currentUserId, onForward, onClose }: Props) {
  const { conversations } = useChatStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [forwarded, setForwarded] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const getConvName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    const other = conv.participants.find((p) => (p._id || p.id) !== currentUserId);
    return other?.name || 'Chat';
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = getConvName(c).toLowerCase();
      return name.includes(q);
    });
  }, [conversations, search, currentUserId]);

  const handleForward = () => {
    if (!selected || !msg.content) return;
    onForward(selected, msg.content);
    setForwarded(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <Forward size={18} className={styles.headerIcon} />
          <h3 className={styles.title}>Forward message</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Message preview */}
        <div className={styles.preview}>
          <p className={styles.previewText}>
            {msg.deletedForEveryone
              ? '🚫 Deleted message'
              : msg.content?.slice(0, 120) || '(attachment)'}
          </p>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Conversation list */}
        <div className={styles.list}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>No conversations found</p>
          ) : (
            filtered.map((conv) => {
              const name = getConvName(conv);
              const isSelected = selected === conv._id;
              return (
                <button
                  key={conv._id}
                  className={`${styles.convItem} ${isSelected ? styles.convItemSelected : ''}`}
                  onClick={() => setSelected(isSelected ? null : conv._id)}
                >
                  <Avatar name={name} size="sm" />
                  <span className={styles.convName}>{name}</span>
                  {isSelected && <Check size={16} className={styles.checkIcon} />}
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.forwardBtn}
            onClick={handleForward}
            disabled={!selected || forwarded}
          >
            {forwarded ? '✓ Forwarded!' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  );
}
