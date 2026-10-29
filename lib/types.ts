/**
 * Data shapes mirroring the backend JSON (backend/core/models.py,
 * backend/models/*.py). The mock layer returns these exact shapes, so
 * flipping NEXT_PUBLIC_USE_MOCK=false needs no component changes.
 */

export type SourceSystem = 'romania_seap';

export type ProcedureType = 'open' | 'restricted' | 'negotiated' | 'direct' | 'framework';

/** Raw tender as stored by the backend + adapter-extracted display fields. */
export interface Tender {
  source_system: SourceSystem;
  external_id: string;
  country_code: string;
  title: string;
  cpv_codes: string[];
  estimated_value: number | null;
  currency: string | null;
  publication_date: string | null; // ISO date
  submission_deadline: string | null; // ISO date
  raw_description: string | null;
  source_url: string | null;
  // Adapter-extracted (SEAP notice) display fields:
  authority: string;
  county: string;
  procedure_type: ProcedureType;
  clarification_deadline: string | null; // ISO date
}

/**
 * Full company profile, mirroring backend CompanyDetail one to one
 * (backend/api/schemas.py). Nullable = not yet onboarded. Note the two
 * money fields are deliberately separate: annual_turnover is yearly
 * revenue, similar_experience_value is the cumulative value of past
 * similar contracts — the eligibility engine thresholds them apart.
 */
export interface CompanyProfile {
  id: number;
  name: string;
  cui: string;
  industry: string | null;
  founded_year: number | null;
  team_size: number | null;
  cpv_codes: string[];
  secondary_cpv_codes: string[];
  annual_capacity: number | null;
  certifications: string[];
  blacklist_keywords: string[];
  annual_turnover: number | null;
  annual_turnover_currency: string | null;
  similar_experience_value: number | null;
  similar_experience_currency: string | null;
  similar_experience_contract_count: number | null;
  target_countries: string[];
  keywords: string[];
}

/** One wizard step: every field optional, only provided keys are applied. */
export type CompanyPatch = Partial<Omit<CompanyProfile, 'id'>>;

export interface OnboardingStatus {
  company_id: number | null;
  complete: boolean;
  required: string[];
  optional: string[];
  missing_required: string[];
  missing_optional: string[];
}

export interface IndustryOption {
  key: string;
  label: string;
  suggested_cpv_codes: string[];
}

export interface KeywordOption {
  key: string;
  label: string;
  related_cpv_codes: string[];
}

export interface CountryOption {
  code: string;
  name: string;
  source_systems: string[];
}

export interface CompanyOptions {
  industries: IndustryOption[];
  keywords: KeywordOption[];
  countries: CountryOption[];
}

export interface AuthMe {
  sub: string;
  email: string;
  name: string;
  provider: string;
  company_ids: number[];
}

/** Backend per-company tender status (models/user_tender_state.py). */
export type PipelineStatus = 'new' | 'reviewing' | 'applied' | 'rejected' | 'ignored';

/** Self-declared bidding readiness per country — never system-verified. */
export type AuthorizationStatus = 'not_started' | 'in_progress' | 'obtained';

export interface CountryAuthorization {
  country_code: string;
  status: AuthorizationStatus;
  requirement_notes: string | null;
  updated_at: string; // ISO datetime
}

export interface AuthorizationPatch {
  status?: AuthorizationStatus | null;
  requirement_notes?: string | null;
}

export interface CountryRequirements {
  country_code: string;
  name: string | null;
  guide_available: boolean;
  guidance: string;
}

export interface TenderState {
  score: number | null; // 0-100 AI match score
  score_reasons: string[];
  ai_summary: string | null;
  ai_title_simplified: string | null;
  extracted_requirements: string[];
  eligible: boolean | null; // null = uncertain, never guessed
  /**
   * Separate dimension from `eligible`: the company's self-declared
   * readiness for this tender's country. Null = no row opened yet.
   * The two must never be merged into one verdict in the UI.
   */
  country_authorization_status: AuthorizationStatus | null;
  matched_requirements: string[];
  unmet_requirements: string[];
  /** Qualification documents the company still needs to provide. */
  missing_documents: string[];
  eligibility_justification: string | null;
  status: PipelineStatus;
}

/** Joined shape the API returns per company (GET /api/tenders?company_id=…). */
export interface TenderWithState extends Tender {
  state: TenderState;
}

export interface EvidenceDocument {
  id: string;
  name: string;
  type: string;
  valid_until: string | null; // ISO date
}

export type KanbanColumn = 'new' | 'preparing' | 'submitted' | 'archived';

/** Kanban columns ↔ backend statuses. Archive holds rejected + ignored. */
export const STATUS_TO_COLUMN: Record<PipelineStatus, KanbanColumn> = {
  new: 'new',
  reviewing: 'preparing',
  applied: 'submitted',
  rejected: 'archived',
  ignored: 'archived',
};

export const COLUMN_TO_STATUS: Record<KanbanColumn, PipelineStatus> = {
  new: 'new',
  preparing: 'reviewing',
  submitted: 'applied',
  archived: 'rejected',
};

/** Stable client key; route param uses external_id (unique within one source). */
export const tenderKey = (t: Pick<Tender, 'source_system' | 'external_id'>): string =>
  `${t.source_system}:${t.external_id}`;

/** Specialist AI agents behind the draft generator (display order). */
export type AgentId = 'spec' | 'eligibility' | 'legal' | 'writer' | 'risk';

export type AgentState = 'pending' | 'active' | 'done';

/** One generated draft section, attributed to the agent that wrote it. */
export interface DraftSection {
  agent: AgentId;
  title: string;
  body: string;
}
