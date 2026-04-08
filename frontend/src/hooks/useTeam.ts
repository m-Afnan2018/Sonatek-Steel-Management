'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { TeamMember } from '@/types';

export function useTeam(autoFetch = true) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/team');
      setMembers(data);
    } catch {
      setError('Failed to fetch team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchMembers();
  }, [autoFetch, fetchMembers]);

  return { members, loading, error, fetchMembers };
}
