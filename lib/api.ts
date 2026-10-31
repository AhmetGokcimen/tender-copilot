/**
 * Data-access layer. With NEXT_PUBLIC_USE_MOCK=true (default) every function
 * returns mock data in the exact backend JSON shape; with "false" it calls
 * the real FastAPI backend. Components and hooks never branch on this flag.
 *
 * Mock writes (create/patch company) go to the persisted company store, so
 * the wizard and settings stay consistent offline. Real mode attaches the
 * JWT from /auth/callback to every call.
 */
import type {
  AuthMe,
  AuthorizationPatch,
  CompanyOptions,
  CompanyPatch,
  CompanyProfile,
  CountryAuthorization,
  CountryRequirements,
  EvidenceDocument,
  OnboardingStatus,
  TenderWithState,
} from './types';
import {
  MOCK_COMPANY,
  MOCK_EVIDENCE,
  MOCK_ME,
  MOCK_OPTIONS,
  MOCK_TENDERS,
  mockRequirementsFor,
} from './mock-data';
import { authHeaders } from './auth';
import { deriveOnboardingStatus } from './onboarding';
import { useAuthorizationStore } from '@/stores/useAuthorizationStore';
import { useCompanyStore } from '@/stores/useCompanyStore';

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
// Same-origin by default: the FastAPI app serves /api on the same Vercel
// deployment, and local `next dev` proxies /api to the uvicorn backend
// (see next.config.mjs). Set NEXT_PUBLIC_API_URL only to point at a
// remote API explicitly.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fail(prefix: string, path: string, res: Response): Promise<never> {
  let detail = '';
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') detail = `: ${body.detail}`;
  } catch {
    /* non-JSON error body — status alone is enough */
  }
  throw new Error(`${prefix} ${path} failed: ${res.status}${detail}`);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: { ...authHeaders() },
  });
  if (!res.ok) await fail('GET', path, res);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail('POST', path, res);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail('PATCH', path, res);
  return res.json() as Promise<T>;
}

/**
 * Mock derivation mirroring the backend feed: each tender's
 * country_authorization_status comes from the auth store row for that
 * tender's country (null when no row exists).
 */
function overlayAuthorization(tenders: TenderWithState[]): TenderWithState[] {
  const byCountry = new Map(
    useAuthorizationStore.getState().rows.map((r) => [r.country_code, r.status]),
  );
  return tenders.map((t) => ({
    ...t,
    state: { ...t.state, country_authorization_status: byCountry.get(t.country_code) ?? null },
  }));
}

export async function fetchTenders(): Promise<TenderWithState[]> {
  if (USE_MOCK) {
    await delay(350);
    return overlayAuthorization(structuredClone(MOCK_TENDERS));
  }
  return get<TenderWithState[]>('/tenders');
}

export async function fetchTender(externalId: string): Promise<TenderWithState> {
  if (USE_MOCK) {
    await delay(250);
    const tender = MOCK_TENDERS.find((t) => t.external_id === externalId);
    if (!tender) throw new Error(`tender-not-found:${externalId}`);
    return overlayAuthorization(structuredClone([tender]))[0];
  }
  return get<TenderWithState>(`/tenders/${encodeURIComponent(externalId)}`);
}

/** A contract SEAP shows as awarded to a company (public notice data). */
export type WonContract = {
  title: string;
  contracting_authority: string | null;
  cpv_codes: string[];
  value: number | null;
  currency: string | null;
  awarded_on: string | null;
  url: string | null;
};

/** Contracts awarded to this CUI in SEAP, newest first. Empty in mock mode. */
export async function fetchWonContracts(cui: string): Promise<WonContract[]> {
  if (USE_MOCK) return [];
  return get<WonContract[]>(`/awards/won?cui=${encodeURIComponent(cui)}`);
}

export async function fetchCompany(): Promise<CompanyProfile> {
  if (USE_MOCK) {
    await delay(150);
    return structuredClone(useCompanyStore.getState().profile);
  }
  return get<CompanyProfile>('/company');
}

export async function fetchEvidence(): Promise<EvidenceDocument[]> {
  if (USE_MOCK) {
    await delay(150);
    return structuredClone(MOCK_EVIDENCE);
  }
  return get<EvidenceDocument[]>('/company/evidence');
}

export async function fetchMe(): Promise<AuthMe> {
  if (USE_MOCK) {
    await delay(100);
    return structuredClone(MOCK_ME);
  }
  return get<AuthMe>('/auth/me');
}

export async function fetchCompanyOptions(): Promise<CompanyOptions> {
  if (USE_MOCK) {
    await delay(100);
    return structuredClone(MOCK_OPTIONS);
  }
  return get<CompanyOptions>('/company/options');
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  if (USE_MOCK) {
    await delay(100);
    return deriveOnboardingStatus(useCompanyStore.getState().profile);
  }
  return get<OnboardingStatus>('/company/onboarding-status');
}

export async function createCompany(body: CompanyPatch & { name: string }): Promise<CompanyProfile> {
  if (USE_MOCK) {
    await delay(200);
    const store = useCompanyStore.getState();
    store.update({ ...body, id: store.profile.id });
    return structuredClone(useCompanyStore.getState().profile);
  }
  return post<CompanyProfile>('/company', body);
}

export async function patchCompany(body: CompanyPatch): Promise<CompanyProfile> {
  if (USE_MOCK) {
    await delay(200);
    useCompanyStore.getState().update(body);
    return structuredClone(useCompanyStore.getState().profile);
  }
  return patch<CompanyProfile>('/company', body);
}

export async function fetchAuthorizations(): Promise<CountryAuthorization[]> {
  if (USE_MOCK) {
    await delay(100);
    return structuredClone(useAuthorizationStore.getState().rows);
  }
  return get<CountryAuthorization[]>('/company/authorizations');
}

export async function patchAuthorization(
  countryCode: string,
  body: AuthorizationPatch,
): Promise<CountryAuthorization> {
  if (USE_MOCK) {
    await delay(200);
    const store = useAuthorizationStore.getState();
    store.upsert(countryCode, body);
    const row = useAuthorizationStore.getState().rows.find((r) => r.country_code === countryCode);
    if (!row) throw new Error(`authorization-not-found:${countryCode}`);
    return structuredClone(row);
  }
  return patch<CountryAuthorization>(
    `/company/authorizations/${encodeURIComponent(countryCode)}`,
    body,
  );
}

export async function fetchCountryRequirements(countryCode: string): Promise<CountryRequirements> {
  if (USE_MOCK) {
    await delay(100);
    return structuredClone(mockRequirementsFor(countryCode));
  }
  return get<CountryRequirements>(`/countries/${encodeURIComponent(countryCode)}/requirements`);
}
