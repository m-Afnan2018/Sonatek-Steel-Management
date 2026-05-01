'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Bookmark, BookmarkX } from 'lucide-react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { timeAgo } from '@/lib/utils';
import api from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import styles from './SavedMessagesPanel.module.css';

interface SavedMessage {
  _id: string;
  messageId: string;
  conversationId: string;
  content: string;
  senderName: string;
  senderAvatar: string;
  conversationName: string;
  savedAt: string;
}

interface Props {
  onClose: () => void;
  onNavigate: (convId: string) => void;
}

export default function SavedMessagesPanel({ onClose, onNavigate }: Props) {
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { removeSavedMessageId } = useChatStore();

  const fetchSaved = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/chat/saved');
      setSavedMessages(data);
    } catch (err) {
      console.error('fetchSaved:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const handleUnsave = useCallback(async (msgId: string, messageId: string) => {
    try {
      await api.delete(`/chat/messages/${messageId}/save`);
      removeSavedMessageId(messageId);
      setSavedMessages((prev) => prev.filter((s) => s._id !== msgId));
    } catch (err) {
      console.error('handleUnsave:', err);
    }
  }, [removeSavedMessageId]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.headerLeft}>
          <Bookmark size={16} className={styles.headerIcon} />
          <h3 className={styles.panelTitle}>Saved Messages</h3>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className={styles.scrollArea}>
        {loading ? (
          <div className={styles.loadingState}>Loading…</div>
        ) : savedMessages.length === 0 ? (
          <div className={styles.emptyState}>
            <Bookmark size={36} opacity={0.25} />
            <p>No saved messages yet</p>
            <span>Save messages to find them here later.</span>
          </div>
        ) : (
          <div className={styles.list}>
            {savedMessages.map((s) => (
              <div key={s._id} className={styles.item}>
                <button
                  className={styles.itemBody}
                  onClick={() => { onNavigate(s.conversationId); onClose(); }}
                >
                  <div className={styles.itemTop}>
                    <Avatar name={s.senderName || '?'} size="sm" />
                    <div className={styles.itemMeta}>
                      <span className={styles.itemSender}>{s.senderName}</span>
                      <span className={styles.itemConv}>{s.conversationName}</span>
                    </div>
                    <span className={styles.itemTime}>{timeAgo(s.savedAt)}</span>
                  </div>
                  <p className={styles.itemContent}>{s.content?.slice(0, 120)}{s.content?.length > 120 ? '…' : ''}</p>
                </button>
                <button
                  className={styles.unsaveBtn}
                  onClick={() => handleUnsave(s._id, s.messageId)}
                  title="Remove saved message"
                >
                  <BookmarkX size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
