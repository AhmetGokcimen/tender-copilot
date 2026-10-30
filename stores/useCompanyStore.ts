'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompanyProfile } from '@/lib/types';
import { MOCK_COMPANY } from '@/lib/mock-data';

/** Editable company profile (Settings screen). Drives generator output. */
interface CompanyState {
  profile: CompanyProfile;
  update: (patch: Partial<CompanyProfile>) => void;
  reset: () => void;
  resetToEmpty: () => void;
}

/** Blank profile for freshly registered mock accounts (see lib/mock-auth). */
export const EMPTY_COMPANY: CompanyProfile = {
  id: 1,
  name: '',
  cui: '',
  industry: null,
  founded_year: null,
  team_size: null,
  cpv_codes: [],
  secondary_cpv_codes: [],
  annual_capacity: null,
  certifications: [],
  blacklist_keywords: [],
  annual_turnover: null,
  annual_turnover_currency: null,
  similar_experience_value: null,
  similar_experience_currency: null,
  similar_experience_contract_count: null,
  target_countries: [],
  keywords: [],
  website: null,
  subsectors: [],
  annual_capacity_currency: null,
  team_eu_count: null,
  team_non_eu_count: null,
};

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      profile: MOCK_COMPANY,
      update: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      reset: () => set({ profile: MOCK_COMPANY }),
      resetToEmpty: () =>
        set({
          profile: {
            ...EMPTY_COMPANY,
            cpv_codes: [],
            secondary_cpv_codes: [],
            certifications: [],
            blacklist_keywords: [],
            target_countries: [],
            keywords: [],
          },
        }),
    }),
    { name: 'ofera-company' },
  ),
);
