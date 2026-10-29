'use client';

import { create } from 'zustand';
import type { ProcedureType } from '@/lib/types';

export type SortKey = 'match' | 'deadline' | 'value';

interface FilterState {
  search: string;
  county: string;
  procedure: ProcedureType | '';
  minValue: number | null;
  minScore: number;
  cpv: string;
  onlyEligible: boolean;
  sort: SortKey;
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
}

const INITIAL = {
  search: '',
  county: '',
  procedure: '' as ProcedureType | '',
  minValue: null as number | null,
  minScore: 0,
  cpv: '',
  onlyEligible: false,
  sort: 'match' as SortKey,
};

export const useFilterStore = create<FilterState>()((set) => ({
  ...INITIAL,
  set: (patch) => set(patch),
  reset: () => set(INITIAL),
}));
