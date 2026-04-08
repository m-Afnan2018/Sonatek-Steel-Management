'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { Project } from '@/types';

export function useProjects(autoFetch = true) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/projects', { params });
      setProjects(data);
    } catch {
      setError('Failed to fetch projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(async (id: string): Promise<Project | null> => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    } catch {
      setError('Failed to fetch project.');
      return null;
    }
  }, []);

  const createProject = useCallback(async (projectData: Partial<Project>): Promise<Project | null> => {
    try {
      const { data } = await api.post('/projects', projectData);
      setProjects((prev) => [data, ...prev]);
      return data;
    } catch {
      setError('Failed to create project.');
      return null;
    }
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>): Promise<Project | null> => {
    try {
      const { data } = await api.put(`/projects/${id}`, updates);
      setProjects((prev) => prev.map((p) => (p._id === id ? data : p)));
      return data;
    } catch {
      setError('Failed to update project.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchProjects();
  }, [autoFetch, fetchProjects]);

  return { projects, loading, error, fetchProjects, fetchProject, createProject, updateProject };
}
