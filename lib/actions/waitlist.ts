'use server';

export type WaitlistResult = { status: 'ok' | 'invalid' | 'error' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Adds an email to the Supabase `waitlist` table through PostgREST with the
 * service role key (server only; the table has RLS on and no public policy).
 * A duplicate email is ignored and still reported as success, so the form
 * never reveals who already signed up. The hidden `company_website` field is
 * a honeypot: bots that fill it get a fake success and nothing is stored.
 */
export async function joinWaitlist(formData: FormData): Promise<WaitlistResult> {
  if (String(formData.get('company_website') ?? '').trim()) return { status: 'ok' };

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { status: 'invalid' };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('waitlist: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return { status: 'error' };
  }

  const res = await fetch(`${url}/rest/v1/waitlist?on_conflict=email`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({
      email,
      locale: String(formData.get('locale') ?? 'en').slice(0, 8),
      source: String(formData.get('source') ?? 'landing').slice(0, 32),
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('waitlist: insert failed', res.status, await res.text().catch(() => ''));
    return { status: 'error' };
  }
  return { status: 'ok' };
}
