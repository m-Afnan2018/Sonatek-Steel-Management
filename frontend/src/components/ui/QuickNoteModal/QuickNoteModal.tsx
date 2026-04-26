'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import styles from './QuickNoteModal.module.css';

const COLORS = [
  { value: '#6C63FF', label: 'Purple' },
  { value: '#00D4AA', label: 'Teal'   },
  { value: '#FFD32A', label: 'Yellow' },
  { value: '#FF4757', label: 'Red'    },
  { value: '#FF6B81', label: 'Pink'   },
  { value: '#48CAE4', label: 'Blue'   },
  { value: '#E67E22', label: 'Orange' },
  { value: '#9B59B6', label: 'Violet' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuickNoteModal({ open, onClose }: Props) {
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [color, setColor]     = useState(COLORS[0].value);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-focus content on open
  useEffect(() => {
    if (open) {
      setTimeout(() => contentRef.current?.focus(), 60);
    }
  }, [open]);

  // Reset after close animation finishes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setTitle('');
        setContent('');
        setColor(COLORS[0].value);
        setSaved(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!content.trim() && !title.trim()) return;
    setSaving(true);
    try {
      await api.post('/notes', {
        title: title.trim() || 'Quick Note',
        content: content.trim(),
        color,
      });
      setSaved(true);
      setTimeout(onClose, 600);
    } catch {
      setSaving(false);
    }
  }, [title, content, color, onClose]);

  // Ctrl+Enter / Cmd+Enter to save; Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { handleSave(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, handleSave]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={styles.card} style={{ '--note-color': color } as React.CSSProperties}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={styles.pencilIcon}>
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className={styles.headerTitle}>Quick Note</span>
            <span className={styles.shortcutHint}>Shift+N</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Color accent bar */}
        <div className={styles.colorBar} />

        {/* Title */}
        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          maxLength={200}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); contentRef.current?.focus(); } }}
        />

        <div className={styles.divider} />

        {/* Content */}
        <textarea
          ref={contentRef}
          className={styles.contentInput}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing… (Ctrl+Enter to save)"
          rows={6}
          maxLength={10000}
        />

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.colorPicker}>
            {COLORS.map((c) => (
              <button
                key={c.value}
                className={`${styles.colorDot} ${color === c.value ? styles.colorDotActive : ''}`}
                style={{ background: c.value }}
                onClick={() => setColor(c.value)}
                title={c.label}
                aria-label={c.label}
              />
            ))}
          </div>

          <button
            className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}
            onClick={handleSave}
            disabled={saving || saved || (!content.trim() && !title.trim())}
          >
            {saved ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </>
            ) : saving ? (
              'Saving…'
            ) : (
              'Save note'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
