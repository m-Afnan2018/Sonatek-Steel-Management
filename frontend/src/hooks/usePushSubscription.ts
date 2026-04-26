'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export type PushStatus =
  | 'loading'        // checking real subscription state
  | 'unsupported'    // browser has no SW / PushManager / Notification
  | 'denied'         // user blocked notifications in browser
  | 'subscribed'     // active push subscription, delivery on
  | 'paused'         // active push subscription, delivery paused on this device
  | 'not_subscribed' // permission granted but no active push subscription
  | 'not_granted'    // Notification.permission === 'default' — never asked
  | 'sw_unavailable'; // SW not registered / not HTTPS — push impossible here

const ENDPOINT_KEY = 'tracksy_push_endpoint';
const PAUSED_KEY   = 'tracksy_push_paused'; // stores the paused endpoint

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

function permissionOnlyStatus(): PushStatus {
  const p = Notification.permission;
  if (p === 'denied')  return 'denied';
  if (p === 'granted') return 'not_subscribed';
  return 'not_granted';
}

async function getActiveRegistration(timeoutMs: number): Promise<ServiceWorkerRegistration> {
  const readyRace = Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('sw-ready-timeout')), timeoutMs),
    ),
  ]);

  try {
    return await readyRace;
  } catch {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (reg.active) return reg;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('sw-activate-timeout')), 5_000);

      const finish = () => {
        if (reg.active) { clearTimeout(timer); resolve(reg); }
      };

      finish();
      if (reg.active) return;

      const sw = reg.installing || reg.waiting;
      if (!sw) {
        clearTimeout(timer);
        reject(new Error('sw-no-worker'));
        return;
      }

      sw.addEventListener('statechange', function handler() {
        finish();
        if (reg.active) sw.removeEventListener('statechange', handler);
      });
    });
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
        const reg = await navigator.serviceWorker.getRegistration('/');

        if (!reg || !reg.active) {
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
          // Paused if this endpoint is stored in PAUSED_KEY
          const paused = localStorage.getItem(PAUSED_KEY);
          setStatus(paused === sub.endpoint ? 'paused' : 'subscribed');
        } else {
          localStorage.removeItem(ENDPOINT_KEY);
          localStorage.removeItem(PAUSED_KEY);
          setStatus(permissionOnlyStatus());
        }
      } catch {
        localStorage.removeItem(ENDPOINT_KEY);
        setStatus(permissionOnlyStatus());
      }
    };

    check();
  }, []);

  // ── Enable / Resume ───────────────────────────────────────────────────
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
      // If paused, just resume — browser subscription is still alive
      const reg0 = await navigator.serviceWorker.getRegistration('/');
      if (reg0) {
        const existingSub = await reg0.pushManager.getSubscription();
        if (existingSub && localStorage.getItem(PAUSED_KEY) === existingSub.endpoint) {
          await api.post('/push/resume', { endpoint: existingSub.endpoint });
          localStorage.removeItem(PAUSED_KEY);
          setStatus('subscribed');
          setLoading(false);
          return;
        }
      }

      // Fresh subscribe flow
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result === 'denied') { setStatus('denied');       setLoading(false); return; }
        if (result !== 'granted') {                           setLoading(false); return; }
      }

      let reg: ServiceWorkerRegistration;
      try {
        reg = await getActiveRegistration(12_000);
      } catch (swErr) {
        console.error('[Push] SW not available:', swErr);
        setStatus('sw_unavailable');
        setLoading(false);
        return;
      }

      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        console.error('[Push] VAPID public key missing — check VAPID_PUBLIC_KEY in backend .env');
        setStatus(permissionOnlyStatus());
        setLoading(false);
        return;
      }

      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      } catch (subErr) {
        console.error('[Push] pushManager.subscribe failed:', subErr);
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

      const j = sub.toJSON();
      await api.post('/push/subscribe', { endpoint: j.endpoint, keys: j.keys });
      localStorage.setItem(ENDPOINT_KEY, sub.endpoint!);
      localStorage.removeItem(PAUSED_KEY);

      setStatus('subscribed');
    } catch (err) {
      console.error('[Push] enable() failed:', err);
      setStatus(permissionOnlyStatus());
    }

    setLoading(false);
  }, []);

  // ── Disable = pause delivery (browser subscription stays alive) ───────
  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.post('/push/pause', { endpoint: sub.endpoint }).catch(() => {});
          localStorage.setItem(PAUSED_KEY, sub.endpoint);
          setStatus('paused');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('[Push] pause() failed:', err);
    }
    // Fallback: no subscription found
    localStorage.removeItem(PAUSED_KEY);
    setStatus(permissionOnlyStatus());
    setLoading(false);
  }, []);

  // ── Reset = full unsubscribe (browser + backend) ──────────────────────
  const reset = useCallback(async () => {
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
      console.error('[Push] reset() failed:', err);
    }
    localStorage.removeItem(ENDPOINT_KEY);
    localStorage.removeItem(PAUSED_KEY);
    setStatus(permissionOnlyStatus());
    setLoading(false);
  }, []);

  return { status, loading, enable, disable, reset };
}
