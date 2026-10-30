'use server';

import { inviteValid } from '@/lib/invite';
import { SUPABASE_URL } from '@/lib/supabase-public';

export type InviteSignupResult = { status: 'ok' | 'invalid_invite' | 'exists' | 'weak' | 'not_configured' | 'error' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Creates a Supabase Auth account for someone holding the owner's invite.
 * Public sign-ups stay disabled in Supabase; this server action is the only
 * way in, using the service-role key (server env only, never shipped to the
 * browser). The account is created confirmed, so the user signs in at once.
 */
export async function createInvitedAccount(input: {
  invite: string;
  name: string;
  email: string;
  password: string;
  company: string;
}): Promise<InviteSignupResult> {
  if (!inviteValid(input.invite)) return { status: 'invalid_invite' };
  const email = String(input.email ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  if (!EMAIL.test(email) || email.length > 254) return { status: 'error' };
  if (password.length < 8 || password.length > 72) return { status: 'weak' };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { status: 'not_configured' };

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      // Checked by the auth.users trigger (supabase/migrations): only
      // invited accounts may be created.
      app_metadata: { invited: true },
      user_metadata: {
        name: String(input.name ?? '').trim().slice(0, 120),
        company: String(input.company ?? '').trim().slice(0, 200),
      },
    }),
    cache: 'no-store',
  });
  if (res.ok) return { status: 'ok' };
  const body = (await res.json().catch(() => ({}))) as { code?: string; error_code?: string; msg?: string };
  const code = body.error_code ?? body.code ?? '';
  if (res.status === 422 && /exists|registered/i.test(`${code} ${body.msg ?? ''}`)) return { status: 'exists' };
  if (/weak_password/.test(code)) return { status: 'weak' };
  return { status: 'error' };
}
