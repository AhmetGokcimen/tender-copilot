/**
 * Assistant data-access layer. Mock mode answers locally via the rule-based
 * engine; real mode POSTs the question + DOM context to the backend. The
 * response contract is identical either way: structured fields only —
 * `{ message, highlight_selector, agent }`, plus an optional `revision`
 * proposal when the user asked to edit the open workspace document.
 * The model never ships code.
 */
import type { AgentId } from './types';
import type { DomContextNode } from './dom-context';
import { mockAssistantReply } from './assistant-mock';

/** Bounded snapshot of the open workspace document (revision targeting). */
export interface DocEditContext {
  key: string;
  title: string;
  headings: string[];
  paragraphs: string[];
}

export interface AssistantRequest {
  question: string;
  pathname: string;
  tenderId: string | null;
  dom: DomContextNode[];
  history: { role: 'user' | 'ai'; text: string }[];
  /** Present only when revising the open document on a tender detail page. */
  doc: DocEditContext | null;
}

/** A proposed document edit the user must accept or reject. */
export interface DocRevision {
  /** Snippet identifying the paragraph to replace; '' appends a new one. */
  target: string;
  before: string;
  after: string;
}

export interface AssistantResponse {
  message: string;
  highlight_selector: string | null;
  agent: AgentId;
  revision?: DocRevision | null;
}

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
// Same-origin by default — see lib/api.ts for why. Override only to point
// at a remote API explicitly.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function postAssistant(req: AssistantRequest): Promise<AssistantResponse> {
  if (USE_MOCK) return mockAssistantReply(req);
  const res = await fetch(`${API_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`POST /assistant/chat failed: ${res.status}`);
  return res.json() as Promise<AssistantResponse>;
}

/**
 * REAL-INTEGRATION NOTE (queued, not implemented): when the backend takes
 * over, its system prompt must include exactly:
 *  (a) the active page's [data-assistant] hook list (label + selector) from
 *      the `dom` field of this request, and
 *  (b) the constraint "return highlight_selector from this list only —
 *      never invent a new selector".
 * That turns DOM targeting into a whitelist without trusting model output;
 * the frontend's isSafeSelector gate stays as defense in depth.
 * For document edits, the backend receives `doc` (open document snapshot)
 * and returns `revision: { target, before, after }` — the frontend applies
 * it to the editor JSON only after the user presses Accept.
 */
