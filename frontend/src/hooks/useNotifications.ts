'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import type { Notification } from '@/types';

const STORAGE_KEY = 'tracksy_notif_seen';
export const BROWSER_NOTIF_KEY = 'tracksy_browser_notif_enabled';
const POLL_MS = 30_000;

export function isBrowserNotifEnabled(): boolean {
  try { return localStorage.getItem(BROWSER_NOTIF_KEY) !== 'false'; } catch { return true; }
}

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const seen = getSeenIds();
    seen.add(id);
    const arr = Array.from(seen).slice(-300);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

async function requestPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (window.Notification.permission === 'granted') return true;
  if (window.Notification.permission === 'denied') return false;
  const result = await window.Notification.requestPermission();
  return result === 'granted';
}

function fireBrowserNotif(notif: Notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;

  const n = new window.Notification(notif.title, {
    body: notif.message,
    icon: '/icon-192x192.png',
    tag: notif._id,
    silent: false,
  });

  n.onclick = () => {
    window.focus();
    if (notif.link) window.location.href = notif.link;
    n.close();
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const permAskedRef = useRef(false);

  const processFresh = useCallback(async (fresh: Notification[]) => {
    if (!isBrowserNotifEnabled()) return;
    const seen = getSeenIds();
    const novel = fresh.filter((n) => !n.isRead && !seen.has(n._id));
    if (novel.length === 0) return;

    // Ask for permission once, lazily, on the first novel notification
    if (!permAskedRef.current) {
      permAskedRef.current = true;
      await requestPermission();
    }

    for (const n of novel) {
      fireBrowserNotif(n);
      markSeen(n._id);
    }
  }, []);

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get<Notification[]>('/notifications');
      setNotifications(data);
      await processFresh(data);
    } catch {
      // ignore — network errors shouldn't break the UI
    }
  }, [processFresh]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, POLL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount, markAllRead, refetch: fetch };
}
