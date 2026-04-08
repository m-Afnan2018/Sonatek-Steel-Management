'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { Resource } from '@/types';

export function useResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResources = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      const { data } = await api.get('/resources', { params });
      setResources(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const createResource = useCallback(async (resourceData: Partial<Resource>): Promise<Resource | null> => {
    try {
      const { data } = await api.post('/resources', resourceData);
      setResources((prev) => [data, ...prev]);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateResource = useCallback(async (id: string, updates: Partial<Resource>): Promise<Resource | null> => {
    try {
      const { data } = await api.put(`/resources/${id}`, updates);
      setResources((prev) => prev.map((r) => (r._id === id ? data : r)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteResource = useCallback(async (id: string) => {
    try {
      await api.delete(`/resources/${id}`);
      setResources((prev) => prev.filter((r) => r._id !== id));
    } catch {
      // ignore
    }
  }, []);

  const returnResource = useCallback(async (id: string): Promise<Resource | null> => {
    try {
      const { data } = await api.post(`/resources/${id}/return`);
      setResources((prev) => prev.map((r) => (r._id === id ? data : r)));
      return data;
    } catch {
      return null;
    }
  }, []);

  return { resources, loading, fetchResources, createResource, updateResource, deleteResource, returnResource };
}
