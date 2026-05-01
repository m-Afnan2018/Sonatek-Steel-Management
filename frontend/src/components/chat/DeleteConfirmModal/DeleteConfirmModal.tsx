'use client';

import { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import styles from './DeleteConfirmModal.module.css';

interface Props {
  forEveryone: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ forEveryone, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <Trash2 size={20} />
          </div>
          <h3 id="delete-title" className={styles.title}>Delete message?</h3>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <p className={styles.body}>
          {forEveryone
            ? 'This message will be permanently removed for everyone in this conversation.'
            : 'This message will be removed from your view only.'}
        </p>

        <div className={styles.actions}>
          <button ref={cancelRef} className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`${styles.confirmBtn} ${forEveryone ? styles.dangerBtn : styles.grayBtn}`}
            onClick={onConfirm}
          >
            {forEveryone ? 'Delete for everyone' : 'Delete for me'}
          </button>
        </div>
      </div>
    </div>
  );
}
