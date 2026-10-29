'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PipelineStatus } from '@/lib/types';

/**
 * Client-side pipeline overrides, keyed by tender external_id.
 * Effective status = store override ?? tender.state.status from the API.
 * Persisted so the kanban board survives reloads during the demo.
 */
interface PipelineState {
  statuses: Record<string, PipelineStatus>;
  setStatus: (externalId: string, status: PipelineStatus) => void;
  untrack: (externalId: string) => void;
}

const SEED: Record<string, PipelineStatus> = {
  CN1065104: 'reviewing',
  CN1064559: 'applied',
};

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set) => ({
      statuses: SEED,
      setStatus: (externalId, status) =>
        set((s) => ({ statuses: { ...s.statuses, [externalId]: status } })),
      untrack: (externalId) =>
        set((s) => {
          const next = { ...s.statuses };
          delete next[externalId];
          return { statuses: next };
        }),
    }),
    { name: 'ofera-pipeline' },
  ),
);
