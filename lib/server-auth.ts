import 'server-only';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase-public';

/**
 * Server actions are public HTTP endpoints: anyone can call one without our
 * pages. The actions that fetch remote pages or spend AI credits (company
 * site scan, document scan, ANAF lookup) call this first, with the Supabase
 * access token the signed-in browser sends along. Supabase checks the token,
 * so accounts stay invite-only here too. Local development skips the check,
 * because mock mode has no Supabase session.
 */
export async function signedIn(accessToken: unknown): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true;
  if (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 4096) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
