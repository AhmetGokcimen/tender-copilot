'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emptyBidInputs, type BidInputs } from '@/lib/bid-inputs';

interface State {
  byTender: Record<string, BidInputs>;
  /** Who signs and where the company sits carry over between tenders. */
  identity: Pick<BidInputs, 'repName' | 'repRole' | 'address' | 'size'>;
  forTender: (tenderId: string) => BidInputs;
  save: (tenderId: string, inputs: BidInputs) => void;
}

/**
 * The company's own answers for each tender's documents. Declarations and
 * prices are kept per tender (and need confirming again each time: `confirmed`
 * is cleared when loaded); only the signer and address carry over.
 */
export const useBidInputsStore = create<State>()(
  persist(
    (set, get) => ({
      byTender: {},
      identity: { repName: '', repRole: '', address: '', size: null },
      forTender: (tenderId) => {
        const saved = get().byTender[tenderId];
        const base = { ...emptyBidInputs(), ...get().identity };
        return saved ? { ...base, ...saved, confirmed: false } : base;
      },
      save: (tenderId, inputs) =>
        set((s) => ({
          byTender: { ...s.byTender, [tenderId]: inputs },
          identity: { repName: inputs.repName, repRole: inputs.repRole, address: inputs.address, size: inputs.size },
        })),
    }),
    { name: 'licits-bid-inputs' },
  ),
);
