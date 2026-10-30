'use client';

import { USE_MOCK } from '@/lib/api';
import { supabase } from '@/lib/supabase/browser';

/**
 * The company profile behind onboarding and matching, stored in Supabase
 * (tables in supabase/migrations, RLS: members of the company only). Mock
 * mode keeps the same shape in localStorage so the demo runs offline.
 * Field names mirror the database columns.
 */

export type Company = {
  id: string;
  name: string;
  cui: string | null;
  website: string | null;
  address: string | null;
  county: string | null;
  caen_main: string | null;
  caen_secondary: string[];
  vat_payer: boolean | null;
  active: boolean | null;
  founded_year: number | null;
  trades: string[];
  cpv_codes: string[];
  blacklist: string[];
  regions: string[];
  roles: string[];
  subcontract_out: string[];
  max_contract_value: number | null;
  max_contract_currency: string | null;
  concurrent_projects: number | null;
  seap_registered: boolean | null;
  esignature: boolean | null;
  esignature_expires_on: string | null;
  duae_experience: boolean | null;
  team_eu: number | null;
  team_non_eu: number | null;
  guarantee_instruments: string[];
  guarantee_limit: number | null;
  credit_line: number | null;
  cash_available: number | null;
  money_currency: string;
  ongoing_value: number | null;
  ongoing_until: string | null;
  tax_debt: boolean | null;
  insolvency: boolean | null;
  past_termination: boolean | null;
  has_car_insurance: boolean | null;
  has_liability_insurance: boolean | null;
  seap_history: 'none' | 'bid' | 'won' | null;
  sworn_translation: boolean | null;
  notify_email: boolean;
  notify_frequency: 'instant' | 'daily' | 'weekly' | 'off';
  min_days_to_deadline: number;
  onboarding_completed_at: string | null;
};

export type TurnoverYear = { year: number; amount: number; currency: string; source: 'anaf' | 'manual' | 'document' };

export type Credential = {
  id: string;
  category: 'authorization' | 'certification';
  kind: string;
  name: string;
  type_class: string | null;
  number: string | null;
  issuer: string | null;
  holder: string | null;
  scope: string | null;
  issued_on: string | null;
  expires_on: string | null;
  document_id: string | null;
  source: 'manual' | 'document';
};

export type Contract = {
  id: string;
  kind: 'works' | 'services' | 'supplies';
  title: string;
  client: string | null;
  country: string;
  trades: string[];
  cpv_codes: string[];
  value: number | null;
  currency: string;
  end_year: number | null;
  completion_certificate: boolean | null;
  role: 'lead' | 'subcontractor' | 'partner';
  share_pct: number | null;
  document_id: string | null;
};

export const STAFF_ROLES = ['project_manager', 'site_manager', 'rte', 'hse', 'anre_electrician', 'engineer'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type CompanyDocument = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  doc_type: string | null;
  status: 'uploaded' | 'scanning' | 'scanned' | 'failed';
  extracted: Record<string, unknown> | null;
  created_at: string;
};

export type CompanyData = {
  company: Company;
  turnover: TurnoverYear[];
  credentials: Credential[];
  contracts: Contract[];
  staff: Partial<Record<StaffRole, number>>;
  documents: CompanyDocument[];
};

export const emptyCompany = (id = ''): Company => ({
  id,
  name: '',
  cui: null,
  website: null,
  address: null,
  county: null,
  caen_main: null,
  caen_secondary: [],
  vat_payer: null,
  active: null,
  founded_year: null,
  trades: [],
  cpv_codes: [],
  blacklist: [],
  regions: [],
  roles: [],
  subcontract_out: [],
  max_contract_value: null,
  max_contract_currency: null,
  concurrent_projects: null,
  seap_registered: null,
  esignature: null,
  esignature_expires_on: null,
  duae_experience: null,
  team_eu: null,
  team_non_eu: null,
  guarantee_instruments: [],
  guarantee_limit: null,
  credit_line: null,
  cash_available: null,
  money_currency: 'RON',
  ongoing_value: null,
  ongoing_until: null,
  tax_debt: null,
  insolvency: null,
  past_termination: null,
  has_car_insurance: null,
  has_liability_insurance: null,
  seap_history: null,
  sworn_translation: null,
  notify_email: true,
  notify_frequency: 'daily',
  min_days_to_deadline: 10,
  onboarding_completed_at: null,
});

const emptyData = (id = ''): CompanyData => ({
  company: emptyCompany(id),
  turnover: [],
  credentials: [],
  contracts: [],
  staff: {},
  documents: [],
});

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/* ------------------------------------------------------------------ */
/* Mock store (localStorage, one profile per mock account)              */
/* ------------------------------------------------------------------ */

const mockKey = () => `licits-company:${window.localStorage.getItem('ofera-mock-session') ?? 'anon'}`;

function readMock(): CompanyData | null {
  try {
    const raw = window.localStorage.getItem(mockKey());
    if (!raw) return null;
    const data = JSON.parse(raw) as CompanyData;
    return { ...emptyData(data.company.id), ...data, company: { ...emptyCompany(data.company.id), ...data.company } };
  } catch {
    return null;
  }
}

function writeMock(data: CompanyData) {
  window.localStorage.setItem(mockKey(), JSON.stringify(data));
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/** The signed-in user's company, or null when they have none yet. */
export async function loadCompanyData(): Promise<CompanyData | null> {
  if (USE_MOCK) return readMock();
  const sb = supabase();
  const { data: companies, error } = await sb.from('companies').select('*').order('created_at').limit(1);
  fail(error);
  const company = companies?.[0] as Company | undefined;
  if (!company) return null;
  const id = company.id;
  const [turnover, credentials, contracts, staff, documents] = await Promise.all([
    sb.from('company_turnover').select('year, amount, currency, source').eq('company_id', id).order('year', { ascending: false }),
    sb.from('company_credentials').select('*').eq('company_id', id).order('created_at'),
    sb.from('company_contracts').select('*').eq('company_id', id).order('end_year', { ascending: false }),
    sb.from('company_staff').select('role, count').eq('company_id', id),
    sb.from('company_documents').select('*').eq('company_id', id).order('created_at', { ascending: false }),
  ]);
  for (const r of [turnover, credentials, contracts, staff, documents]) fail(r.error);
  return {
    company: { ...emptyCompany(id), ...company },
    turnover: (turnover.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as TurnoverYear[],
    credentials: (credentials.data ?? []) as Credential[],
    contracts: (contracts.data ?? []).map((c) => ({ ...c, value: c.value === null ? null : Number(c.value) })) as Contract[],
    staff: Object.fromEntries((staff.data ?? []).map((s) => [s.role, s.count])),
    documents: (documents.data ?? []) as CompanyDocument[],
  };
}

/** Creates the company on first save, then updates it. Returns its id. */
export async function saveCompany(id: string | null, patch: Partial<Company>): Promise<string> {
  const { id: _ignore, ...fields } = patch;
  if (USE_MOCK) {
    const current = readMock() ?? emptyData(newId());
    writeMock({ ...current, company: { ...current.company, ...fields } });
    return current.company.id;
  }
  const sb = supabase();
  if (!id) {
    const { data, error } = await sb.from('companies').insert(fields).select('id').single();
    fail(error);
    return (data as { id: string }).id;
  }
  const { error } = await sb.from('companies').update(fields).eq('id', id);
  fail(error);
  return id;
}

/** Replaces the turnover rows with the given years. */
export async function saveTurnover(companyId: string, rows: TurnoverYear[]): Promise<void> {
  if (USE_MOCK) {
    const current = readMock();
    if (current) writeMock({ ...current, turnover: rows });
    return;
  }
  const sb = supabase();
  const { error } = await sb.from('company_turnover').delete().eq('company_id', companyId);
  fail(error);
  if (rows.length) fail((await sb.from('company_turnover').insert(rows.map((r) => ({ ...r, company_id: companyId })))).error);
}

/** Replaces credentials (authorizations + certifications) with the given list. */
export async function saveCredentials(companyId: string, rows: Credential[]): Promise<void> {
  if (USE_MOCK) {
    const current = readMock();
    if (current) writeMock({ ...current, credentials: rows });
    return;
  }
  const sb = supabase();
  const keep = rows.map((r) => r.id);
  const del = sb.from('company_credentials').delete().eq('company_id', companyId);
  fail((await (keep.length ? del.not('id', 'in', `(${keep.join(',')})`) : del)).error);
  if (rows.length) fail((await sb.from('company_credentials').upsert(rows.map((r) => ({ ...r, company_id: companyId })))).error);
}

export async function saveContracts(companyId: string, rows: Contract[]): Promise<void> {
  if (USE_MOCK) {
    const current = readMock();
    if (current) writeMock({ ...current, contracts: rows });
    return;
  }
  const sb = supabase();
  const keep = rows.map((r) => r.id);
  const del = sb.from('company_contracts').delete().eq('company_id', companyId);
  fail((await (keep.length ? del.not('id', 'in', `(${keep.join(',')})`) : del)).error);
  if (rows.length) fail((await sb.from('company_contracts').upsert(rows.map((r) => ({ ...r, company_id: companyId })))).error);
}

export async function saveStaff(companyId: string, staff: Partial<Record<StaffRole, number>>): Promise<void> {
  if (USE_MOCK) {
    const current = readMock();
    if (current) writeMock({ ...current, staff });
    return;
  }
  const rows = Object.entries(staff).map(([role, count]) => ({ company_id: companyId, role, count: count ?? 0 }));
  if (rows.length) fail((await supabase().from('company_staff').upsert(rows)).error);
}

/** Stores an uploaded file (Supabase Storage in real mode) and its row. */
export async function addDocument(companyId: string, file: File): Promise<CompanyDocument> {
  const id = newId();
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-120);
  const doc: CompanyDocument = {
    id,
    storage_path: `${companyId}/${id}/${safeName}`,
    file_name: file.name.slice(0, 200),
    mime_type: file.type || null,
    size_bytes: file.size,
    doc_type: null,
    status: 'uploaded',
    extracted: null,
    created_at: new Date().toISOString(),
  };
  if (USE_MOCK) {
    const current = readMock();
    if (current) writeMock({ ...current, documents: [doc, ...current.documents] });
    return doc;
  }
  const sb = supabase();
  fail((await sb.storage.from('company-documents').upload(doc.storage_path, file, { contentType: file.type })).error);
  const { created_at: _c, ...row } = doc;
  fail((await sb.from('company_documents').insert({ ...row, company_id: companyId })).error);
  return doc;
}

export async function updateDocument(id: string, patch: Partial<CompanyDocument>): Promise<void> {
  if (USE_MOCK) {
    const current = readMock();
    if (current) writeMock({ ...current, documents: current.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
    return;
  }
  fail((await supabase().from('company_documents').update(patch).eq('id', id)).error);
}

export async function removeDocument(doc: CompanyDocument): Promise<void> {
  if (USE_MOCK) {
    const current = readMock();
    if (current) writeMock({ ...current, documents: current.documents.filter((d) => d.id !== doc.id) });
    return;
  }
  const sb = supabase();
  fail((await sb.storage.from('company-documents').remove([doc.storage_path])).error);
  fail((await sb.from('company_documents').delete().eq('id', doc.id)).error);
}

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

/** The last three closed financial years (balance sheets land by mid-year). */
export function turnoverYears(today = new Date()): number[] {
  const latest = today.getMonth() >= 6 ? today.getFullYear() - 1 : today.getFullYear() - 2;
  return [latest, latest - 1, latest - 2];
}

/** Credential state for warnings: expired, expiring within 90 days, or fine. */
export function credentialState(c: Pick<Credential, 'expires_on'>, today = new Date()): 'expired' | 'expiring' | 'valid' | 'unknown' {
  if (!c.expires_on) return 'unknown';
  const days = (new Date(c.expires_on).getTime() - today.getTime()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days < 90) return 'expiring';
  return 'valid';
}

/**
 * How complete the profile is, for the "profile strength" meter. Weighted
 * toward what most often disqualifies a bid.
 */
export function profileStrength(d: CompanyData): { pct: number; missing: string[] } {
  const c = d.company;
  const checks: [string, number, boolean][] = [
    ['identity', 10, Boolean(c.name && c.cui)],
    ['caen', 5, Boolean(c.caen_main)],
    ['works', 15, c.cpv_codes.length > 0],
    ['turnover', 15, d.turnover.length >= 3],
    ['credentials', 15, d.credentials.length > 0 && d.credentials.every((x) => x.expires_on || x.category === 'certification')],
    ['contracts', 15, d.contracts.length > 0],
    ['guarantees', 5, c.guarantee_limit !== null || c.cash_available !== null],
    ['staff', 10, Object.values(d.staff).some((n) => (n ?? 0) > 0)],
    ['seap', 5, c.seap_registered !== null && c.esignature !== null],
    ['exclusion', 5, c.tax_debt !== null && c.insolvency !== null && c.past_termination !== null],
  ];
  const pct = checks.reduce((s, [, w, ok]) => s + (ok ? w : 0), 0);
  return { pct, missing: checks.filter(([, , ok]) => !ok).map(([k]) => k) };
}
