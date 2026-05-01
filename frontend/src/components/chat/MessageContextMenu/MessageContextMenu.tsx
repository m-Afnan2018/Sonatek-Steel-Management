'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  CornerUpLeft,
  Smile,
  Copy,
  Pencil,
  Trash2,
  Trash,
  Forward,
  Pin,
  Bookmark,
} from 'lucide-react';
import styles from './MessageContextMenu.module.css';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface Props {
  position: ContextMenuPosition;
  isSelf: boolean;
  onReply: () => void;
  onReact: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onForward: () => void;
  onClose: () => void;
  isPinned?: boolean;
  onPin?: () => void;
  isSaved?: boolean;
  onSave?: () => void;
}

export default function MessageContextMenu({
  position,
  isSelf,
  onReply,
  onReact,
  onCopy,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onForward,
  onClose,
  isPinned = false,
  onPin,
  isSaved = false,
  onSave,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleAction = useCallback((fn: () => void) => {
    fn();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  // Position calculation — keep inside viewport
  const MENU_WIDTH = 180;
  const MENU_HEIGHT = isSelf ? 300 : 220;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const x = position.x + MENU_WIDTH > vw ? position.x - MENU_WIDTH : position.x;
  const y = position.y + MENU_HEIGHT > vh ? position.y - MENU_HEIGHT : position.y;

  return (
    <div
      className={styles.menu}
      style={{ top: y, left: x }}
      ref={menuRef}
      role="menu"
      aria-label="Message actions"
    >
      <button className={styles.item} onClick={() => handleAction(onReply)}>
        <CornerUpLeft size={14} />
        <span>Reply</span>
      </button>

      <button className={styles.item} onClick={() => handleAction(onReact)}>
        <Smile size={14} />
        <span>React</span>
      </button>

      <button className={styles.item} onClick={() => handleAction(onCopy)}>
        <Copy size={14} />
        <span>Copy</span>
      </button>

      <button className={styles.item} onClick={() => handleAction(onForward)}>
        <Forward size={14} />
        <span>Forward</span>
      </button>

      {onPin && (
        <button className={styles.item} onClick={() => handleAction(onPin)}>
          <Pin size={14} />
          <span>{isPinned ? 'Unpin message' : 'Pin message'}</span>
        </button>
      )}

      {onSave && (
        <button className={styles.item} onClick={() => handleAction(onSave)}>
          <Bookmark size={14} />
          <span>{isSaved ? 'Unsave message' : 'Save message'}</span>
        </button>
      )}

      {isSelf && (
        <>
          <div className={styles.separator} />

          <button className={styles.item} onClick={() => handleAction(onEdit)}>
            <Pencil size={14} />
            <span>Edit</span>
          </button>

          <button
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={() => handleAction(onDeleteForMe)}
          >
            <Trash size={14} />
            <span>Delete for me</span>
          </button>

          <button
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={() => handleAction(onDeleteForEveryone)}
          >
            <Trash2 size={14} />
            <span>Delete for everyone</span>
          </button>
        </>
      )}
    </div>
  );
}
