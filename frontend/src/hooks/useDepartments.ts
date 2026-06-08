import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { Department } from '@/types';

export function useDepartments(autoFetch = true) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/departments');
      setDepartments(data);
    } catch {
      setError('Failed to load departments.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createDepartment = useCallback(async (payload: {
    name: string;
    description?: string;
    color?: string;
    headId?: string;
  }): Promise<Department | null> => {
    try {
      const { data } = await api.post('/departments', payload);
      setDepartments((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateDepartment = useCallback(async (
    id: string,
    payload: { name?: string; description?: string; color?: string }
  ): Promise<Department | null> => {
    try {
      const { data } = await api.put(`/departments/${id}`, payload);
      setDepartments((prev) => prev.map((d) => (d._id === id ? data : d)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteDepartment = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/departments/${id}`);
      setDepartments((prev) => prev.filter((d) => d._id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  const addMember = useCallback(async (deptId: string, userId: string): Promise<Department | null> => {
    setError(null);
    try {
      const { data } = await api.post(`/departments/${deptId}/members`, { userId });
      setDepartments((prev) => prev.map((d) => (d._id === deptId ? data : d)));
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to add member.';
      setError(msg);
      return null;
    }
  }, []);

  const removeMember = useCallback(async (deptId: string, userId: string): Promise<{ data: Department | null; error: string | null }> => {
    setError(null);
    try {
      const { data } = await api.delete(`/departments/${deptId}/members/${userId}`);
      setDepartments((prev) => prev.map((d) => (d._id === deptId ? data : d)));
      return { data, error: null };
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to remove member.';
      setError(msg);
      return { data: null, error: msg };
    }
  }, []);

  const addHead = useCallback(async (deptId: string, userId: string): Promise<Department | null> => {
    try {
      const { data } = await api.post(`/departments/${deptId}/heads`, { userId });
      setDepartments((prev) => prev.map((d) => (d._id === deptId ? data : d)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const removeHead = useCallback(async (deptId: string, userId: string): Promise<Department | null> => {
    try {
      const { data } = await api.delete(`/departments/${deptId}/heads/${userId}`);
      setDepartments((prev) => prev.map((d) => (d._id === deptId ? data : d)));
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchDepartments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    departments,
    loading,
    error,
    fetchDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    addMember,
    removeMember,
    addHead,
    removeHead,
  };
}
