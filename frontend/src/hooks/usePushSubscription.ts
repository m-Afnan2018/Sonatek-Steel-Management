'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export type PushStatus =
  | 'loading'        // checking real subscription state
  | 'unsupported'    // browser has no SW / PushManager / Notification
  | 'denied'         // user blocked notifications in browser
  | 'subscribed'     // active push subscription on this device
  | 'not_subscribed' // permission granted but no active push subscription
  | 'not_granted'    // Notification.permission === 'default' — never asked
  | 'sw_unavailable'; // SW not registered / not HTTPS — push impossible here

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

/** Returns permission-derived status when SW isn't involved. */
function permissionOnlyStatus(): PushStatus {
  const p = Notification.permission;
  if (p === 'denied')  return 'denied';
  if (p === 'granted') return 'not_subscribed';
  return 'not_granted';
}

/**
 * Gets an active ServiceWorkerRegistration, registering /sw.js if needed.
 * Waits up to `timeoutMs` for the SW to become active.
 */
async function getActiveRegistration(timeoutMs: number): Promise<ServiceWorkerRegistration> {
  // Check for any existing registration first
  let reg = await navigator.serviceWorker.getRegistration('/');

  if (!reg) {
    // No SW registered at all — try to register the production SW
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  // If already active, return immediately
  if (reg.active) return reg;

  // Wait for installing/waiting to become active
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('sw-activate-timeout')),
      timeoutMs,
    );

    const checkActive = () => {
      if (reg!.active) {
        clearTimeout(timer);
        resolve(reg!);
        return;
      }
    };

    const sw = reg!.installing || reg!.waiting;
    if (!sw) {
      clearTimeout(timer);
      reject(new Error('sw-no-worker'));
      return;
    }

    sw.addEventListener('statechange', function handler() {
      checkActive();
      if (reg!.active) sw.removeEventListener('statechange', handler);
    });

    checkActive();
  });
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [loading, setLoading] = useState(false);
  const checked = useRef(false);

  // ── Check real subscription state on mount ────────────────────────────
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

    const check = async () => {
      try {
        // Quick check: is there any registration at all?
        const reg = await navigator.serviceWorker.getRegistration('/');

        if (!reg || !reg.active) {
          // No active SW — can't check subscription, use permission as signal
          localStorage.removeItem(ENDPOINT_KEY);
          setStatus(permissionOnlyStatus());
          return;
        }

        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          // Re-sync with backend if endpoint changed
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
          setStatus(permissionOnlyStatus());
        }
      } catch {
        localStorage.removeItem(ENDPOINT_KEY);
        setStatus(permissionOnlyStatus());
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
      // 1. Request notification permission
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result === 'denied') { setStatus('denied');       setLoading(false); return; }
        if (result !== 'granted') {                           setLoading(false); return; }
      }

      // 2. Fetch VAPID public key from backend
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        console.error('[Push] VAPID public key missing — check VAPID_PUBLIC_KEY in backend .env');
        setStatus('sw_unavailable');
        setLoading(false);
        return;
      }

      // 3. Get or register the service worker (wait up to 10 s)
      let reg: ServiceWorkerRegistration;
      try {
        reg = await getActiveRegistration(10_000);
      } catch (swErr) {
        console.error('[Push] SW not available:', swErr);
        setStatus('sw_unavailable');
        setLoading(false);
        return;
      }

      // 4. Subscribe to push via PushManager
      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      } catch (subErr) {
        console.error('[Push] pushManager.subscribe failed:', subErr);
        // Already subscribed with different key? Unsubscribe first then retry
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe();
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        } else {
          throw subErr;
        }
      }

      // 5. Save subscription to backend
      const j = sub.toJSON();
      await api.post('/push/subscribe', { endpoint: j.endpoint, keys: j.keys });
      localStorage.setItem(ENDPOINT_KEY, sub.endpoint!);

      setStatus('subscribed');
    } catch (err) {
      console.error('[Push] enable() failed:', err);
      setStatus(permissionOnlyStatus());
    }

    setLoading(false);
  }, []);

  // ── Disable ───────────────────────────────────────────────────────────
  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
        }
      }
    } catch (err) {
      console.error('[Push] disable() failed:', err);
    }
    localStorage.removeItem(ENDPOINT_KEY);
    setStatus(permissionOnlyStatus());
    setLoading(false);
  }, []);

  return { status, loading, enable, disable };
}
