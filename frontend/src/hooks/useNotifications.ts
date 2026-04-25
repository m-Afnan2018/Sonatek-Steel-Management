'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import type { Notification } from '@/types';

export const BROWSER_NOTIF_KEY = 'tracksy_browser_notif_enabled';

// How often to poll the server for new data (kept short for UI freshness)
const POLL_MS = 30_000;

// How long between repeat browser notifications for the same unread item
const REPEAT_MS = 10 * 60 * 1000; // 10 minutes

export function isBrowserNotifEnabled(): boolean {
  try { return localStorage.getItem(BROWSER_NOTIF_KEY) !== 'false'; } catch { return true; }
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
    tag: `${notif._id}-${Date.now()}`, // unique tag so repeats aren't silently replaced
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

  // Tracks when each notification ID was last fired as a browser notification.
  // In-memory only — resets on page load so unread items always remind on first load.
  const lastFiredAt = useRef<Map<string, number>>(new Map());
  const permAskedRef = useRef(false);

  const processUnread = useCallback(async (all: Notification[]) => {
    if (!isBrowserNotifEnabled()) return;

    const unread = all.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    // Request permission once, lazily
    if (!permAskedRef.current) {
      permAskedRef.current = true;
      const granted = await requestPermission();
      if (!granted) return;
    }
    if (window.Notification.permission !== 'granted') return;

    const now = Date.now();
    for (const n of unread) {
      const last = lastFiredAt.current.get(n._id);
      // Fire if never fired, or if 10 minutes have passed since last fire
      if (last === undefined || now - last >= REPEAT_MS) {
        fireBrowserNotif(n);
        lastFiredAt.current.set(n._id, now);
      }
    }
  }, []);

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get<Notification[]>('/notifications');
      setNotifications(data);
      await processUnread(data);
    } catch {
      // ignore — network errors shouldn't break the UI
    }
  }, [processUnread]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, POLL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      // Clear fired-at tracking so if they somehow become unread again they'd re-fire
      lastFiredAt.current.clear();
    } catch {
      // ignore
    }
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      lastFiredAt.current.delete(id);
    } catch {
      // ignore
    }
  }, []);

  const clearOne = useCallback(async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      lastFiredAt.current.delete(id);
    } catch {
      // ignore
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
      lastFiredAt.current.clear();
    } catch {
      // ignore
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount, markAllRead, markOneRead, clearOne, clearAll, refetch: fetch };
}
