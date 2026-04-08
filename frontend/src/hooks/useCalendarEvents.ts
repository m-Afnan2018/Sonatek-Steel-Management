'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { CalendarEvent } from '@/types';

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (month: number, year: number, userId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      if (userId) params.set('userId', userId);
      const { data } = await api.get(`/calendar-events?${params}`);
      setEvents(data);
    } catch {
      setError('Failed to load calendar events.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createEvent = useCallback(async (payload: Record<string, unknown>): Promise<CalendarEvent | null> => {
    try {
      const { data } = await api.post('/calendar-events', payload);
      setEvents((prev) => [...prev, data]);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateEvent = useCallback(async (id: string, payload: Record<string, unknown>): Promise<CalendarEvent | null> => {
    try {
      const { data } = await api.put(`/calendar-events/${id}`, payload);
      setEvents((prev) => prev.map((e) => (e._id === id ? data : e)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/calendar-events/${id}`);
      setEvents((prev) => prev.filter((e) => e._id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { events, loading, error, fetchEvents, createEvent, updateEvent, deleteEvent };
}
