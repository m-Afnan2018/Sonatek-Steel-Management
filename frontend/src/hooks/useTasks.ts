'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { Task } from '@/types';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUserTasks, setAllUserTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/tasks', { params });
      setTasks(data);
    } catch {
      setError('Failed to fetch tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPersonalTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/tasks', { params: { personal: 'true' } });
      setTasks(data);
    } catch {
      setError('Failed to fetch tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllUserTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tasks/all');
      setAllUserTasks(data);
    } catch {
      setError('Failed to fetch all user tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTask = useCallback(async (id: string): Promise<Task | null> => {
    try {
      const { data } = await api.get(`/tasks/${id}`);
      return data;
    } catch {
      setError('Failed to fetch task.');
      return null;
    }
  }, []);

  const createTask = useCallback(async (taskData: Partial<Task>): Promise<Task | null> => {
    try {
      const { data } = await api.post('/tasks', taskData);
      setTasks((prev) => [...prev, data]);
      return data;
    } catch {
      setError('Failed to create task.');
      return null;
    }
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>): Promise<Task | null> => {
    try {
      const { data } = await api.put(`/tasks/${id}`, updates);
      setTasks((prev) => prev.map((t) => (t._id === id ? data : t)));
      return data;
    } catch {
      setError('Failed to update task.');
      return null;
    }
  }, []);

  const updateTaskStatus = useCallback(async (id: string, status: string, order?: number): Promise<Task | null> => {
    try {
      const { data } = await api.put(`/tasks/${id}/status`, { status, order });
      setTasks((prev) => prev.map((t) => (t._id === id ? data : t)));
      return data;
    } catch {
      setError('Failed to update task status.');
      return null;
    }
  }, []);

  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      return true;
    } catch {
      setError('Failed to delete task.');
      return false;
    }
  }, []);

  const addComment = useCallback(async (taskId: string, content: string, mentions?: string[]) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments`, { content, mentions });
      return data;
    } catch {
      setError('Failed to add comment.');
      return null;
    }
  }, []);

  const logHours = useCallback(async (taskId: string, hours: number) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/log-hours`, { hours });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, loggedHours: data.loggedHours } : t)));
      return data;
    } catch {
      setError('Failed to log hours.');
      return null;
    }
  }, []);

  const startTimer = useCallback(async (taskId: string): Promise<Task | null> => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/start`);
      setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)));
      return data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start timer.';
      setError(msg);
      return null;
    }
  }, []);

  const pauseTimer = useCallback(async (taskId: string): Promise<Task | null> => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/pause`);
      setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)));
      return data;
    } catch {
      setError('Failed to pause timer.');
      return null;
    }
  }, []);

  const doneTimer = useCallback(async (taskId: string): Promise<Task | null> => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/done`);
      setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)));
      return data;
    } catch {
      setError('Failed to complete timer.');
      return null;
    }
  }, []);

  return {
    tasks, allUserTasks, loading, error,
    fetchTasks, fetchPersonalTasks, fetchAllUserTasks, fetchTask,
    createTask, updateTask, updateTaskStatus, deleteTask,
    addComment, logHours,
    startTimer, pauseTimer, doneTimer,
  };
}
