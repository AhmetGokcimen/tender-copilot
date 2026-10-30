'use client';

import { createCompany, patchCompany } from '@/lib/api';
import { toRon } from '@/lib/fx';
import type { CompanyData } from '@/lib/company-data';
import type { CompanyPatch } from '@/lib/types';

/**
 * Bridge while the tender pipeline (FastAPI) still keeps its own company
 * record: after onboarding, the fields it scores and checks eligibility
 * with are copied there. Remove once the backend reads the Supabase
 * profile directly.
 */
export async function syncLegacyProfile(d: CompanyData): Promise<void> {
  const c = d.company;
  const years = [...d.turnover].filter((r) => r.amount > 0).sort((a, b) => b.year - a.year);
  const latest = years[0];
  const contracts = d.contracts.filter((k) => k.value);
  const experience = contracts.reduce((s, k) => s + (toRon(k.value ?? 0, k.currency, k.end_year ?? new Date().getFullYear()) ?? 0), 0);
  const patch: CompanyPatch = {
    name: c.name,
    cui: c.cui ?? '',
    industry: 'construction',
    cpv_codes: c.cpv_codes,
    blacklist_keywords: c.blacklist,
    certifications: d.credentials.map((x) => (x.type_class ? `${x.name} ${x.type_class}` : x.name)),
    annual_turnover: latest ? latest.amount : null,
    annual_turnover_currency: latest ? latest.currency : null,
    annual_capacity: c.max_contract_value,
    annual_capacity_currency: c.max_contract_currency,
    similar_experience_value: experience || null,
    similar_experience_currency: experience ? 'RON' : null,
    similar_experience_contract_count: contracts.length || null,
    team_size: (c.team_eu ?? 0) + (c.team_non_eu ?? 0) || null,
    team_eu_count: c.team_eu,
    team_non_eu_count: c.team_non_eu,
    founded_year: c.founded_year,
    website: c.website,
    subsectors: c.trades,
    target_countries: ['RO'],
  };
  try {
    await patchCompany(patch);
  } catch {
    await createCompany({ ...patch, name: c.name });
  }
}
