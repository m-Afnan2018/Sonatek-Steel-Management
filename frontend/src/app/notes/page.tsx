'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useNotes } from '@/hooks/useNotes';
import type { Note } from '@/types';
import styles from './notes.module.css';

const NOTE_COLORS = ['#6C63FF', '#00D4AA', '#FF4757', '#FFD32A', '#FF6B81', '#48CAE4', '#9B59B6', '#E67E22'];

export default function NotesPage() {
  const { notes, loading, fetchNotes, createNote, updateNote, deleteNote, pinNote } = useNotes();
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState(NOTE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Global keyboard shortcut: Ctrl+Shift+N
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setShowNew(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    await createNote(newTitle, newContent, newColor);
    setSaving(false);
    setShowNew(false);
    setNewTitle('');
    setNewContent('');
    setNewColor(NOTE_COLORS[0]);
  };

  const handleSaveEdit = async () => {
    if (!editingNote) return;
    setSaving(true);
    await updateNote(editingNote._id, { title: editingNote.title, content: editingNote.content, color: editingNote.color });
    setSaving(false);
    setEditingNote(null);
  };

  const handlePin = useCallback(async (id: string) => {
    await pinNote(id);
  }, [pinNote]);

  const pinned = notes.filter((n) => n.isPinned);
  const unpinned = notes.filter((n) => !n.isPinned);

  return (
    <AppShell title="Notes">
      <div className={styles.page}>
        <div className={styles.header}>
          <p className={styles.shortcutHint}>Press <span className={styles.kbd}>Ctrl+Shift+N</span> to quickly create a note</p>
          <Button onClick={() => setShowNew(true)}>+ New Note</Button>
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : (
          <>
            {pinned.length > 0 && (
              <section>
                <h3 className={styles.sectionTitle}>Pinned</h3>
                <div className={styles.grid}>
                  {pinned.map((note) => (
                    <NoteCard key={note._id} note={note} onEdit={setEditingNote} onPin={handlePin} onDelete={deleteNote} />
                  ))}
                </div>
              </section>
            )}
            {unpinned.length > 0 && (
              <section>
                {pinned.length > 0 && <h3 className={styles.sectionTitle}>Others</h3>}
                <div className={styles.grid}>
                  {unpinned.map((note) => (
                    <NoteCard key={note._id} note={note} onEdit={setEditingNote} onPin={handlePin} onDelete={deleteNote} />
                  ))}
                </div>
              </section>
            )}
            {notes.length === 0 && (
              <div className={styles.empty}>
                <p>No notes yet. Create your first note or press Ctrl+Shift+N.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Note Panel */}
      {showNew && (
        <div className={styles.overlay} onClick={() => setShowNew(false)}>
          <div className={styles.noteEditor} onClick={(e) => e.stopPropagation()} style={{ borderTop: `4px solid ${newColor}` }}>
            <h3 className={styles.editorTitle}>New Note</h3>
            <input
              className={styles.noteTitleInput}
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <textarea
              className={styles.noteContentInput}
              placeholder="Write your note..."
              rows={6}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <div className={styles.colorPicker}>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${newColor === c ? styles.colorActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className={styles.editorActions}>
              <Button variant="secondary" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} loading={saving} disabled={!newTitle.trim()}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Panel */}
      {editingNote && (
        <div className={styles.overlay} onClick={() => setEditingNote(null)}>
          <div className={styles.noteEditor} onClick={(e) => e.stopPropagation()} style={{ borderTop: `4px solid ${editingNote.color}` }}>
            <h3 className={styles.editorTitle}>Edit Note</h3>
            <input
              className={styles.noteTitleInput}
              value={editingNote.title}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              autoFocus
            />
            <textarea
              className={styles.noteContentInput}
              rows={6}
              value={editingNote.content}
              onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
            />
            <div className={styles.colorPicker}>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${editingNote.color === c ? styles.colorActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setEditingNote({ ...editingNote, color: c })}
                />
              ))}
            </div>
            <div className={styles.editorActions}>
              <Button variant="secondary" size="sm" onClick={() => setEditingNote(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit} loading={saving}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function NoteCard({ note, onEdit, onPin, onDelete }: {
  note: Note;
  onEdit: (n: Note) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.noteCard} style={{ borderTop: `3px solid ${note.color}` }}>
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle}>{note.title}</h4>
        <div className={styles.cardActions}>
          <button className={styles.cardBtn} onClick={() => onPin(note._id)} title={note.isPinned ? 'Unpin' : 'Pin'}>
            {note.isPinned ? '📌' : '📍'}
          </button>
          <button className={styles.cardBtn} onClick={() => onEdit(note)} title="Edit">✏️</button>
          <button className={styles.cardBtn} onClick={() => { if (confirm('Delete this note?')) onDelete(note._id); }} title="Delete">🗑️</button>
        </div>
      </div>
      <p className={styles.cardContent}>{note.content}</p>
    </div>
  );
}
