import type { CompanyProfile, OnboardingStatus } from './types';

/**
 * Mock-mode mirror of the backend completeness rules
 * (backend/core/lookups.py): required name + industry + annual_turnover.
 * Real mode never calls this — it asks GET /company/onboarding-status.
 */
const REQUIRED = ['name', 'industry', 'annual_turnover'];
const OPTIONAL = [
  'founded_year',
  'team_size',
  'certifications',
  'target_countries',
  'keywords',
  'cui',
];

function filled(profile: CompanyProfile, field: string): boolean {
  const value: unknown = (profile as unknown as Record<string, unknown>)[field];
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' || Array.isArray(value)) return value.length > 0;
  return true;
}

export function deriveOnboardingStatus(profile: CompanyProfile): OnboardingStatus {
  const missingRequired = REQUIRED.filter((f) => !filled(profile, f));
  const missingOptional = OPTIONAL.filter((f) => !filled(profile, f));
  return {
    company_id: profile.id,
    complete: missingRequired.length === 0,
    required: [...REQUIRED],
    optional: [...OPTIONAL],
    missing_required: missingRequired,
    missing_optional: missingOptional,
  };
}
