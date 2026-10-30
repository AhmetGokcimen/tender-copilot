'use server';

/**
 * Company lookup by CUI from ANAF's public web services, for onboarding:
 * - PlatitorTvaRest (v9): legal name, address, county, main CAEN code,
 *   registration date, VAT and inactive status;
 * - bilant: the balance sheet filed for a given year, from which we take
 *   net turnover ("Cifra de afaceri netă").
 * Both are free and need no key. They are rate limited (about one request
 * per second), so the years are fetched in sequence. Field names follow
 * ANAF's published responses; anything missing just comes back empty and
 * the user fills it in.
 */

export type AnafCompany = {
  name: string;
  address: string | null;
  county: string | null;
  caenMain: string | null;
  registeredOn: string | null;
  foundedYear: number | null;
  vatPayer: boolean | null;
  active: boolean | null;
};
export type AnafTurnover = { year: number; amount: number };
export type AnafResult =
  | { status: 'ok'; company: AnafCompany; turnover: AnafTurnover[] }
  | { status: 'invalid' | 'not_found' | 'unavailable' };

// Overridable for local testing against a stand-in server.
const BASE = process.env.ANAF_BASE_URL || 'https://webservicesp.anaf.ro';
const TIMEOUT_MS = 8000;

async function getJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function lookupCompany(rawCui: string, years: number[]): Promise<AnafResult> {
  const digits = String(rawCui ?? '').toUpperCase().replace(/^RO/, '').replace(/\D/g, '');
  if (digits.length < 2 || digits.length > 10) return { status: 'invalid' };
  const cui = Number(digits);
  const today = new Date().toISOString().slice(0, 10);

  const tva = (await getJson(`${BASE}/api/PlatitorTvaRest/v9/tva`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ cui, data: today }]),
  })) as { found?: Record<string, Record<string, unknown>>[] } | null;
  if (!tva) return { status: 'unavailable' };
  const found = tva.found?.[0];
  if (!found) return { status: 'not_found' };

  const general = found.date_generale ?? {};
  const seat = found.adresa_sediu_social ?? {};
  const registeredOn = str(general.data_inregistrare);
  const company: AnafCompany = {
    name: str(general.denumire) ?? '',
    address: str(general.adresa),
    county: str(seat.sdenumire_Judet),
    caenMain: str(general.cod_CAEN),
    registeredOn,
    foundedYear: registeredOn ? Number(registeredOn.slice(0, 4)) || null : null,
    vatPayer: typeof found.inregistrare_scop_Tva?.scpTVA === 'boolean' ? (found.inregistrare_scop_Tva.scpTVA as boolean) : null,
    active:
      typeof found.stare_inactiv?.statusInactivi === 'boolean' ? !(found.stare_inactiv.statusInactivi as boolean) : null,
  };

  const turnover: AnafTurnover[] = [];
  for (const year of years.slice(0, 5)) {
    await sleep(1100);
    const bilant = (await getJson(`${BASE}/bilant?an=${year}&cui=${cui}`)) as {
      i?: { val_indicator?: number; val_den_indicator?: string }[];
    } | null;
    const row = bilant?.i?.find((x) => /cifra de afaceri net/i.test(x.val_den_indicator ?? ''));
    if (row && typeof row.val_indicator === 'number') turnover.push({ year, amount: row.val_indicator });
  }
  return { status: 'ok', company, turnover };
}
