'use client';

import { useSyncExternalStore } from 'react';

/**
 * JWT session handling. Real mode stores the token from /auth/callback in
 * localStorage and attaches it to every API call; mock mode never touches
 * it. Token changes broadcast so queries re-resolve without a reload.
 */
const TOKEN_KEY = 'ofera-token';
const TOKEN_EVENT = 'ofera-token-changed';

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return readToken();
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function subscribe(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener('storage', handler);
  window.addEventListener(TOKEN_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(TOKEN_EVENT, handler);
  };
}

export function useAuthToken(): string | null {
  return useSyncExternalStore(subscribe, readToken, () => null);
}
