'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { Attendance, AttendanceStats } from '@/types';

export function useAttendance() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [teamRecords, setTeamRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = (err: unknown, fallback: string) => {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
    setError(msg);
    return null;
  };

  const checkIn = useCallback(async (workMode?: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/attendance/check-in', { workMode });
      return data;
    } catch (err) {
      return handleError(err, 'Check-in failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkOut = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/attendance/check-out');
      return data;
    } catch (err) {
      return handleError(err, 'Check-out failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const lunchStart = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/attendance/lunch-start');
      return data;
    } catch (err) {
      return handleError(err, 'Lunch start failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const lunchStop = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/attendance/lunch-stop');
      return data;
    } catch (err) {
      return handleError(err, 'Lunch stop failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const addNote = useCallback(async (date: string, content: string, documents?: string[], links?: string[]): Promise<{ data: Attendance | null; error: string | null }> => {
    try {
      const { data } = await api.post('/attendance/notes', { date, content, documents, links });
      return { data, error: null };
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add note.';
      return { data: null, error: msg };
    }
  }, []);

  const deleteNote = useCallback(async (attendanceId: string, noteIndex: number): Promise<Attendance | null> => {
    try {
      const { data } = await api.delete(`/attendance/${attendanceId}/notes/${noteIndex}`);
      return data;
    } catch (err) {
      return handleError(err, 'Failed to delete note.');
    }
  }, []);

  const fetchMyAttendance = useCallback(async (month?: number, year?: number) => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/my', { params: { month, year } });
      setRecords(data);
    } catch {
      setError('Failed to fetch attendance.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserAttendance = useCallback(async (userId: string, month?: number, year?: number) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance/user/${userId}`, { params: { month, year } });
      setRecords(data);
    } catch {
      setError('Failed to fetch attendance.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeamAttendance = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/team', { params: { date } });
      setTeamRecords(data);
    } catch {
      setError('Failed to fetch team attendance.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (month?: number, year?: number) => {
    try {
      const { data } = await api.get('/attendance/stats', { params: { month, year } });
      setStats(data);
    } catch {
      setError('Failed to fetch attendance stats.');
    }
  }, []);

  const fetchUserStats = useCallback(async (userId: string, month?: number, year?: number) => {
    try {
      const { data } = await api.get(`/attendance/user/${userId}/stats`, { params: { month, year } });
      setStats(data);
    } catch {
      setError('Failed to fetch attendance stats.');
    }
  }, []);

  return {
    records, stats, teamRecords, loading, error,
    checkIn, checkOut, lunchStart, lunchStop, addNote, deleteNote,
    fetchMyAttendance, fetchUserAttendance, fetchTeamAttendance, fetchStats, fetchUserStats,
  };
}
