/**
 * MOCK-ONLY local auth. The backend deliberately has no signup/password
 * endpoints (see backend/core/auth.py) — real mode signs in via Google
 * OAuth or the demo token. This module exists so the signup/login UI is
 * fully demonstrable in mock mode: accounts live in localStorage, passwords
 * are stored as SHA-256 hashes (never plaintext), and nothing here is used
 * when NEXT_PUBLIC_USE_MOCK=false.
 */

export interface MockAccount {
  name: string;
  email: string;
  company: string;
  passHash: string;
}

const USERS_KEY = 'ofera-mock-users';
const SESSION_KEY = 'ofera-mock-session';

function readUsers(): MockAccount[] {
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MockAccount[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: MockAccount[]): void {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** SHA-256 hex. Falls back to FNV-1a where SubtleCrypto is unavailable. */
export async function hashPassword(password: string): Promise<string> {
  try {
    const digest = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`ofera-mock:${password}`),
    );
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0x811c9dc5;
    const s = `ofera-mock:${password}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return `fnv1a:${(h >>> 0).toString(16)}`;
  }
}

export type RegisterError = 'exists' | null;

export async function registerMockUser(input: {
  name: string;
  email: string;
  password: string;
  company: string;
}): Promise<{ account: MockAccount; error: RegisterError }> {
  const email = input.email.trim().toLowerCase();
  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    return { account: users.find((u) => u.email === email) as MockAccount, error: 'exists' };
  }
  const account: MockAccount = {
    name: input.name.trim(),
    email,
    company: input.company.trim(),
    passHash: await hashPassword(input.password),
  };
  writeUsers([...users, account]);
  window.localStorage.setItem(SESSION_KEY, email);
  return { account, error: null };
}

export type LoginError = 'unknown' | 'mismatch' | null;

export async function loginMockUser(input: {
  email: string;
  password: string;
}): Promise<{ account: MockAccount | null; error: LoginError }> {
  const email = input.email.trim().toLowerCase();
  const account = readUsers().find((u) => u.email === email) ?? null;
  if (!account) return { account: null, error: 'unknown' };
  const hash = await hashPassword(input.password);
  if (hash !== account.passHash) return { account: null, error: 'mismatch' };
  window.localStorage.setItem(SESSION_KEY, email);
  return { account, error: null };
}

/** Currently signed-in mock account, if any (survives tab close). */
export function getMockSession(): MockAccount | null {
  const email = window.localStorage.getItem(SESSION_KEY);
  if (!email) return null;
  return readUsers().find((u) => u.email === email) ?? null;
}

export function clearMockSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
