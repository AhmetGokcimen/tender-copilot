/**
 * Public Supabase coordinates for the Lichit project. The publishable key is
 * designed to ship to clients; what it can do is limited by RLS (the
 * `waitlist` table only allows INSERT for anon). Env vars override these.
 */
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goqnsooohsohbfpshszh.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_C4BA-bXFNlOy1l6W6Y6toA_A7zvDNpo';
