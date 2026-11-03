/**
 * What only the company can say when its bid documents are made: the
 * declarations it stands behind, who signs, and the prices. Nothing here is
 * ever pre-answered by the tool: an unanswered question stays "[de completat]"
 * in the documents.
 */

export type Choice = 'yes' | 'no' | null;
export type Exclusion = 'applies' | 'not_applies' | null;
export type CompanySize = 'micro' | 'small' | 'medium' | 'large' | null;

export interface BidInputs {
  /** DUAE Part III grounds A-D: does the ground apply to the company or its representatives? */
  exclusion: Record<'A' | 'B' | 'C' | 'D', Exclusion>;
  otherEntities: Choice;
  subcontract: Choice;
  subcontractNote: string;
  size: CompanySize;
  repName: string;
  repRole: string;
  address: string;
  validityDays: string;
  /** Unit price (lei, without VAT) by price-item index, as typed. */
  prices: Record<number, string>;
  /** The company confirmed the answers above are its own. */
  confirmed: boolean;
}

export const emptyBidInputs = (): BidInputs => ({
  exclusion: { A: null, B: null, C: null, D: null },
  otherEntities: null,
  subcontract: null,
  subcontractNote: '',
  size: null,
  repName: '',
  repRole: '',
  address: '',
  validityDays: '',
  prices: {},
  confirmed: false,
});

/** "1.234,50", "1234.5", "120" -> number; NaN-safe (null when not a number). */
export function parseNumber(text: string | undefined | null): number | null {
  if (!text) return null;
  const t = text.trim().replace(/\s/g, '');
  if (t === '') return null;
  const normalised = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

export interface PriceLine {
  qty: number | null;
  unit: number | null;
  value: number | null;
}

export interface Pricing {
  lines: PriceLine[];
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  /** True when every line has a value (the totals are complete). */
  complete: boolean;
}

/** Line values, subtotal, VAT and total, by plain arithmetic. */
export function computePricing(
  items: { quantity: string }[],
  prices: Record<number, string>,
  vatRate: number,
): Pricing {
  const lines = items.map((it, i) => {
    const qty = parseNumber(it.quantity);
    const unit = parseNumber(prices[i]);
    return { qty, unit, value: qty !== null && unit !== null ? round2(qty * unit) : null };
  });
  const priced = lines.filter((l) => l.value !== null);
  const subtotal = priced.length > 0 ? round2(priced.reduce((s, l) => s + (l.value ?? 0), 0)) : null;
  const vat = subtotal !== null ? round2(subtotal * vatRate) : null;
  return {
    lines,
    subtotal,
    vat,
    total: subtotal !== null && vat !== null ? round2(subtotal + vat) : null,
    complete: lines.length > 0 && priced.length === lines.length,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PriceRangeInfo {
  sample_size: number;
  low_pct: number;
  median_pct: number;
  high_pct: number;
  cpv_prefix: string;
}

export interface PriceHint {
  buyer: PriceRangeInfo | null;
  market: PriceRangeInfo | null;
  locked: boolean;
}

export interface VatInfo {
  rate: number;
  effective_from: string;
  source: string;
}
