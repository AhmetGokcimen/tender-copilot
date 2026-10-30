'use server';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase-public';

export type WaitlistResult = { status: 'ok' | 'invalid' | 'error' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Adds an email to the Supabase `waitlist` table through PostgREST with the
 * publishable key. RLS lets anon INSERT only (no read, update or delete),
 * so the list itself stays private. A duplicate email is ignored and still
 * reported as success, so the form never reveals who already signed up. The hidden `company_website` field is
 * a honeypot: bots that fill it get a fake success and nothing is stored.
 */
export async function joinWaitlist(formData: FormData): Promise<WaitlistResult> {
  if (String(formData.get('company_website') ?? '').trim()) return { status: 'ok' };

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { status: 'invalid' };

  // Plain INSERT: ON CONFLICT would need a SELECT policy, which would make
  // the list readable. A duplicate surfaces as 409 (unique violation).
  const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      email,
      locale: String(formData.get('locale') ?? 'en').slice(0, 8),
      source: formData.get('source') === 'closing' ? 'closing' : 'hero',
    }),
    cache: 'no-store',
  });
  if (!res.ok && res.status !== 409) {
    console.error('waitlist: insert failed', res.status, await res.text().catch(() => ''));
    return { status: 'error' };
  }
  return { status: 'ok' };
}
