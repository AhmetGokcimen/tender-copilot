'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthorizationPatch, CountryAuthorization } from '@/lib/types';
import { MOCK_AUTHORIZATIONS } from '@/lib/mock-data';

/** Mock-mode backing store for country authorization rows (persisted). */
interface AuthorizationState {
  rows: CountryAuthorization[];
  upsert: (code: string, patch: AuthorizationPatch) => void;
  reset: () => void;
}

export const useAuthorizationStore = create<AuthorizationState>()(
  persist(
    (set) => ({
      rows: MOCK_AUTHORIZATIONS,
      upsert: (code, patch) =>
        set((s) => {
          const existing = s.rows.find((r) => r.country_code === code);
          const now = new Date().toISOString();
          if (!existing) {
            return {
              rows: [
                ...s.rows,
                {
                  country_code: code,
                  status: patch.status ?? 'not_started',
                  requirement_notes: patch.requirement_notes ?? null,
                  updated_at: now,
                },
              ],
            };
          }
          return {
            rows: s.rows.map((r) =>
              r.country_code === code
                ? {
                    ...r,
                    status: patch.status ?? r.status,
                    requirement_notes: patch.requirement_notes ?? r.requirement_notes,
                    updated_at: now,
                  }
                : r,
            ),
          };
        }),
      reset: () => set({ rows: MOCK_AUTHORIZATIONS }),
    }),
    { name: 'ofera-authorizations' },
  ),
);
