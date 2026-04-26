'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export type PushStatus =
  | 'loading'        // checking real subscription state
  | 'unsupported'    // browser has no SW / PushManager / Notification
  | 'denied'         // user blocked notifications in browser
  | 'subscribed'     // active push subscription on this device
  | 'not_subscribed' // permission granted but no active SW subscription
  | 'not_granted';   // Notification.permission === 'default' — never asked

const ENDPOINT_KEY = 'tracksy_push_endpoint';
const SW_TIMEOUT_MS = 4_000;

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

/** navigator.serviceWorker.ready races against a timeout so we never hang. */
function swReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('sw-timeout')), SW_TIMEOUT_MS)
    ),
  ]);
}

/** Resolve the correct status from Notification.permission alone (SW fallback). */
function permissionStatus(): PushStatus {
  const p = Notification.permission;
  if (p === 'denied')  return 'denied';
  if (p === 'granted') return 'not_subscribed';
  return 'not_granted';
}

async function getVapidKey(): Promise<string | null> {
  try {
    const { data } = await api.get<{ publicKey: string }>('/push/vapid-public-key');
    return data.publicKey || null;
  } catch {
    return null;
  }
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [loading, setLoading] = useState(false);
  const checked = useRef(false);

  // ── Check real subscription state on mount ────────────────────────────
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Guard: feature detection
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    // If already denied, no point waiting for SW
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    const check = async () => {
      try {
        const reg = await swReady();                         // ← times out after 4 s in dev/no-SW
        const sub = await reg.pushManager.getSubscription(); // null if not subscribed

        if (sub) {
          // Re-sync endpoint to backend if localStorage lost it
          const cached = localStorage.getItem(ENDPOINT_KEY);
          if (cached !== sub.endpoint) {
            const j = sub.toJSON();
            api.post('/push/subscribe', { endpoint: j.endpoint, keys: j.keys })
              .then(() => localStorage.setItem(ENDPOINT_KEY, sub.endpoint))
              .catch(() => {});
          }
          setStatus('subscribed');
        } else {
          localStorage.removeItem(ENDPOINT_KEY);
          setStatus(permissionStatus());
        }
      } catch {
        // SW not ready (dev mode, first load, timeout) — use permission as best signal
        localStorage.removeItem(ENDPOINT_KEY);
        setStatus(permissionStatus());
      }
    };

    check();
  }, []);

  // ── Enable ────────────────────────────────────────────────────────────
  const enable = useCallback(async () => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    setLoading(true);
    try {
      // 1. Request permission if needed
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result === 'denied') { setStatus('denied'); setLoading(false); return; }
        if (result !== 'granted') { setLoading(false); return; }
      }

      // 2. Fetch VAPID public key
      const vapidKey = await getVapidKey();
      if (!vapidKey) { setStatus('not_subscribed'); setLoading(false); return; }

      // 3. Subscribe via SW (with timeout)
      const reg = await swReady();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // 4. Save endpoint to backend
      const j = sub.toJSON();
      await api.post('/push/subscribe', { endpoint: j.endpoint, keys: j.keys });
      localStorage.setItem(ENDPOINT_KEY, sub.endpoint!);

      setStatus('subscribed');
    } catch {
      setStatus(permissionStatus());
    }
    setLoading(false);
  }, []);

  // ── Disable ───────────────────────────────────────────────────────────
  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await swReady();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
    } catch {
      // SW not available — still clear local state
    }
    localStorage.removeItem(ENDPOINT_KEY);
    setStatus(permissionStatus()); // 'not_subscribed' since permission was granted
    setLoading(false);
  }, []);

  return { status, loading, enable, disable };
}
