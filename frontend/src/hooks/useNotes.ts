'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { Note } from '@/types';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notes');
      setNotes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const createNote = useCallback(async (title: string, content: string, color?: string): Promise<Note | null> => {
    try {
      const { data } = await api.post('/notes', { title, content, color });
      setNotes((prev) => [data, ...prev]);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>): Promise<Note | null> => {
    try {
      const { data } = await api.put(`/notes/${id}`, updates);
      setNotes((prev) => prev.map((n) => (n._id === id ? data : n)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n._id !== id));
    } catch {
      // ignore
    }
  }, []);

  const pinNote = useCallback(async (id: string): Promise<Note | null> => {
    try {
      const { data } = await api.post(`/notes/${id}/pin`);
      setNotes((prev) => prev.map((n) => (n._id === id ? data : n)).sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)));
      return data;
    } catch {
      return null;
    }
  }, []);

  return { notes, loading, fetchNotes, createNote, updateNote, deleteNote, pinNote };
}
