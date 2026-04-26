'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export type PushStatus =
  | 'loading'        // checking real subscription state
  | 'unsupported'    // browser has no SW / PushManager
  | 'denied'         // user blocked notifications in browser
  | 'subscribed'     // active push subscription on this device
  | 'not_subscribed' // permission granted/default but no active subscription
  | 'not_granted';   // Notification.permission === 'default' — never asked

const ENDPOINT_KEY = 'tracksy_push_endpoint';

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

async function getVapidKey(): Promise<string | null> {
  try {
    const { data } = await api.get<{ publicKey: string }>('/push/vapid-public-key');
    return data.publicKey || null;
  } catch {
    return null;
  }
}

/**
 * Reads the REAL push subscription state from the browser on mount.
 * Returns status + enable/disable actions.
 */
export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [loading, setLoading] = useState(false);
  const checked = useRef(false);

  // ── Check real state on mount ──────────────────────────────────────────
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    // Async check — does the SW have an active push subscription right now?
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          // Ensure backend has this endpoint (re-sync if lost)
          const cached = localStorage.getItem(ENDPOINT_KEY);
          if (cached !== sub.endpoint) {
            const j = sub.toJSON();
            api.post('/push/subscribe', { endpoint: j.endpoint, keys: j.keys })
              .then(() => localStorage.setItem(ENDPOINT_KEY, sub.endpoint))
              .catch(() => {});
          }
          setStatus('subscribed');
        } else {
          // No active subscription
          setStatus(Notification.permission === 'granted' ? 'not_subscribed' : 'not_granted');
          // Clean up stale cache
          localStorage.removeItem(ENDPOINT_KEY);
        }
      })
      .catch(() => {
        // SW not ready (dev mode / no SW) — use permission as best signal
        if (Notification.permission === 'granted') setStatus('not_subscribed');
        else if (Notification.permission === 'denied') setStatus('denied');
        else setStatus('not_granted');
      });
  }, []);

  // ── Enable push ────────────────────────────────────────────────────────
  const enable = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    setLoading(true);
    try {
      // 1. Request permission
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result === 'denied') { setStatus('denied'); setLoading(false); return; }
        if (result !== 'granted') { setLoading(false); return; }
      }

      // 2. Get VAPID key
      const vapidKey = await getVapidKey();
      if (!vapidKey) { setLoading(false); return; }

      // 3. Subscribe via SW
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // 4. Save to backend
      const j = sub.toJSON();
      await api.post('/push/subscribe', { endpoint: j.endpoint, keys: j.keys });
      localStorage.setItem(ENDPOINT_KEY, sub.endpoint);

      setStatus('subscribed');
    } catch {
      setStatus('not_subscribed');
    }
    setLoading(false);
  }, []);

  // ── Disable push ───────────────────────────────────────────────────────
  const disable = useCallback(async () => {
    setLoading(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
        }
      }
      localStorage.removeItem(ENDPOINT_KEY);
      setStatus('not_subscribed');
    } catch {
      setStatus('not_subscribed');
    }
    setLoading(false);
  }, []);

  return { status, loading, enable, disable };
}
