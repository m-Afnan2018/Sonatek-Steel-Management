'use client';

import { useEffect, useRef } from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import type { ChatUser } from '@/store/chatStore';
import styles from './ReactionViewer.module.css';

interface Props {
  emoji: string;
  users: ChatUser[];
  currentUserId: string;
  onToggle: () => void;
  onClose: () => void;
  anchorRect: DOMRect;
}

export default function ReactionViewer({
  emoji,
  users,
  currentUserId,
  onToggle,
  onClose,
  anchorRect,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasReacted = users.some((u) => (u._id || u.id) === currentUserId);

  // Position above anchor; flip below if near top
  const POPOVER_H = 240;
  const POPOVER_W = 220;
  const spaceAbove = anchorRect.top;
  const top = spaceAbove > POPOVER_H + 8
    ? anchorRect.top - POPOVER_H - 8
    : anchorRect.bottom + 8;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - POPOVER_W - 8));

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{ top, left, width: POPOVER_W }}
    >
      <div className={styles.heading}>
        <span className={styles.bigEmoji}>{emoji}</span>
        <span className={styles.count}>{users.length} {users.length === 1 ? 'person' : 'people'}</span>
      </div>
      <div className={styles.userList}>
        {users.map((u) => (
          <div key={u._id || u.id} className={styles.userItem}>
            <Avatar name={u.name || '?'} size="sm" />
            <span className={styles.userName}>{u.name}</span>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <button
          className={`${styles.toggleBtn} ${hasReacted ? styles.toggleBtnActive : ''}`}
          onClick={() => { onToggle(); onClose(); }}
        >
          {hasReacted ? 'Unreact' : 'React'}
        </button>
      </div>
    </div>
  );
}
