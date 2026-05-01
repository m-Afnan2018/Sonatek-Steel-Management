'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X, Pin } from 'lucide-react';
import styles from './PinnedMessagesBanner.module.css';

interface PinnedMsg {
  _id: string;
  content: string;
  sender: { name: string };
}

interface Props {
  pinnedMessages: PinnedMsg[];
  onUnpin: (msgId: string) => void;
  canUnpin: boolean;
  onScrollTo: (msgId: string) => void;
}

export default function PinnedMessagesBanner({ pinnedMessages, onUnpin, canUnpin, onScrollTo }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!pinnedMessages.length) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.bannerHeader} onClick={() => setExpanded((s) => !s)}>
        <div className={styles.bannerLeft}>
          <Pin size={13} className={styles.pinIcon} />
          <span className={styles.bannerTitle}>
            {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          className={styles.collapseBtn}
          onClick={(e) => { e.stopPropagation(); setExpanded((s) => !s); }}
          aria-label={expanded ? 'Collapse pinned messages' : 'Expand pinned messages'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <div className={`${styles.listWrap} ${expanded ? styles.listWrapExpanded : ''}`}>
        <div className={styles.list}>
          {pinnedMessages.map((pm) => (
            <div key={pm._id} className={styles.listItem}>
              <button
                className={styles.itemContent}
                onClick={() => onScrollTo(pm._id)}
                title="Scroll to message"
              >
                <span className={styles.itemSender}>{pm.sender?.name}</span>
                <span className={styles.itemText}>
                  {pm.content?.slice(0, 60)}{pm.content?.length > 60 ? '…' : ''}
                </span>
              </button>
              {canUnpin && (
                <button
                  className={styles.unpinBtn}
                  onClick={() => onUnpin(pm._id)}
                  title="Unpin message"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
