import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    return stored ? JSON.parse(stored)?.state?.accessToken ?? null : null;
  } catch { return null; }
}

/** Upload a single file. Uses a bare axios call so the browser can set
 *  `multipart/form-data; boundary=...` automatically — the api instance's
 *  default `Content-Type: application/json` would otherwise corrupt it. */
export async function uploadFile(file: File): Promise<{
  url: string; name: string; type: 'image' | 'file'; size: number;
}> {
  const body = new FormData();
  body.append('file', file);
  const token = getToken();
  const { data } = await axios.post(`${BASE}/upload`, body, {
    withCredentials: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return data;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const token = parsed?.state?.accessToken;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh lock — prevents multiple simultaneous refresh attempts (race condition)
let isRefreshing = false;
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((item) => {
    if (error) item.reject(error);
    else item.resolve(token as string);
  });
  failedQueue = [];
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    return JSON.parse(stored)?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

function saveToken(token: string) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return;
    const parsed = JSON.parse(stored);
    parsed.state.accessToken = token;
    localStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function forceLogout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-storage');
  window.location.href = '/login';
}

// Response interceptor: handle 401 with queued refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newToken: string = data.accessToken;
      saveToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
