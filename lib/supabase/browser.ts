'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase-public';

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client (one per tab). The session persists in
 * localStorage and refreshes itself; RLS scopes every query to the
 * signed-in user's companies.
 */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
