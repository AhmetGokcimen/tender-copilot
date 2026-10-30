'use client';

import { useEffect, useState } from 'react';
import { USE_MOCK } from '@/lib/api';
import { clearMockSession, getMockSession, loginMockUser } from '@/lib/mock-auth';
import { supabase } from '@/lib/supabase/browser';

/**
 * One session API for both modes. Real mode is Supabase Auth (email and
 * password; accounts are created only through the owner's invite link);
 * mock mode keeps the browser-local accounts so the demo works offline.
 */
export type SessionUser = { id: string; email: string; name: string; company: string };
export type SessionState = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: SessionUser };

const mockUser = (): SessionUser | null => {
  const s = getMockSession();
  return s ? { id: `mock:${s.email}`, email: s.email, name: s.name, company: s.company } : null;
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  useEffect(() => {
    if (USE_MOCK) {
      const u = mockUser();
      setState(u ? { status: 'in', user: u } : { status: 'out' });
      return;
    }
    const sb = supabase();
    const apply = (session: Awaited<ReturnType<typeof sb.auth.getSession>>['data']['session']) => {
      const u = session?.user;
      setState(
        u
          ? {
              status: 'in',
              user: {
                id: u.id,
                email: u.email ?? '',
                name: String(u.user_metadata?.name ?? u.email ?? ''),
                company: String(u.user_metadata?.company ?? ''),
              },
            }
          : { status: 'out' },
      );
    };
    sb.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      apply(session);
      // lib/auth reads the token for backend calls; tell its listeners.
      window.dispatchEvent(new Event('ofera-token-changed'));
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}

export type SignInError = 'unknown' | 'mismatch' | 'unconfirmed' | 'network' | null;

export async function signIn(email: string, password: string): Promise<SignInError> {
  if (USE_MOCK) return (await loginMockUser({ email, password })).error;
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (!error) return null;
  if (/confirm/i.test(error.message)) return 'unconfirmed';
  if (error.status === 400) return 'mismatch';
  return 'network';
}

export async function signOut(): Promise<void> {
  if (USE_MOCK) {
    clearMockSession();
    return;
  }
  await supabase().auth.signOut();
}
