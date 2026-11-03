/** Outputs of the five bid-preparation agents (mirrors backend/core/agents.py). */
import type { AgentId } from './types';

export interface SpecItem {
  ref: string;
  text: string;
  category: 'technical' | 'qualification' | 'financial' | 'contract' | 'documents';
  source: string;
}
export interface SpecAnalysis {
  items: SpecItem[];
  deliverables: string[];
  award_criteria: string;
  duration: string;
  lots: string;
  documents_required: string[];
  source?: 'documents' | 'notice';
  flags?: string[];
}
export interface EligRow {
  ref: string;
  requirement: string;
  status: 'met' | 'not_met' | 'unclear';
  basis: string;
  action: string;
}
export interface EligibilityReview {
  rows: EligRow[];
  summary: string;
}
export interface LegalReview {
  declarations: string[];
  exclusion_notes: string[];
  clauses: { clause: string; concern: string }[];
  flags: string[];
}
export interface TechnicalDraft {
  understanding: string;
  methodology: { title: string; text: string }[];
  work_plan: { phase: string; activities: string; duration: string }[];
  resources: string;
  quality_hse: string;
  compliance: { ref: string; requirement: string; response: string }[];
  price_items: { description: string; unit: string; quantity: string }[];
}
export interface RiskReview {
  risks: { risk: string; likelihood: 'low' | 'medium' | 'high'; impact: 'low' | 'medium' | 'high'; mitigation: string }[];
  missing_before_submission: string[];
  verdict: string;
}

export interface AgentOutputs {
  spec?: SpecAnalysis | null;
  eligibility?: EligibilityReview | null;
  legal?: LegalReview | null;
  writer?: TechnicalDraft | null;
  risk?: RiskReview | null;
}

/** One finished agent's result as a short line for the work log. */
export function agentSummary(agent: AgentId, out: AgentOutputs): { key: string; n: number; m?: number } | null {
  switch (agent) {
    case 'spec':
      return out.spec ? { key: 'doneSpec', n: out.spec.items.length, m: out.spec.documents_required.length } : null;
    case 'eligibility': {
      const rows = out.eligibility?.rows;
      if (!rows) return null;
      return { key: 'doneEligibility', n: rows.filter((r) => r.status === 'met').length, m: rows.length };
    }
    case 'legal':
      return out.legal ? { key: 'doneLegal', n: out.legal.declarations.length, m: out.legal.clauses.length } : null;
    case 'writer':
      return out.writer ? { key: 'doneWriter', n: out.writer.methodology.length, m: out.writer.compliance.length } : null;
    case 'risk':
      return out.risk ? { key: 'doneRisk', n: out.risk.risks.length, m: out.risk.missing_before_submission.length } : null;
  }
}
