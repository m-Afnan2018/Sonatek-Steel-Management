'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import Button from '@/components/ui/Button/Button';
import styles from './QuickNoteModal.module.css';

const NOTE_COLORS = ['#6C63FF', '#00D4AA', '#FF4757', '#FFD32A', '#FF6B81', '#48CAE4', '#9B59B6', '#E67E22'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuickNoteModal({ open, onClose }: Props) {
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [color, setColor]     = useState(NOTE_COLORS[0]);
  const [saving, setSaving]   = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-focus title on open
  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 50);
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTitle('');
      setContent('');
      setColor(NOTE_COLORS[0]);
      setSaving(false);
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.post('/notes', {
        title: title.trim(),
        content: content.trim(),
        color,
      });
      onClose();
    } catch {
      setSaving(false);
    }
  }, [title, content, color, onClose]);

  // Escape to close, Ctrl/Cmd+Enter to save
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, handleSave]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={styles.noteEditor}
        style={{ borderTop: `4px solid ${color}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.editorTitle}>New Note</h3>

        <input
          ref={titleRef}
          className={styles.noteTitleInput}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className={styles.noteContentInput}
          placeholder="Write your note..."
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className={styles.colorPicker}>
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              className={`${styles.colorDot} ${color === c ? styles.colorActive : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className={styles.editorActions}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!title.trim()}>Save</Button>
        </div>
      </div>
    </div>
  );
}
