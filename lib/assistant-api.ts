/**
 * Assistant data-access layer. Mock mode answers locally via the rule-based
 * engine; real mode POSTs the question + DOM context to the backend. The
 * response contract is identical either way: structured fields only —
 * `{ message, highlight_selector, navigate_to, agent }`.
 * The model never ships code.
 */
import type { AgentId } from './types';
import type { DomContextNode } from './dom-context';
import { mockAssistantReply } from './assistant-mock';
import { askAssistant } from './api';

export interface AssistantRequest {
  question: string;
  pathname: string;
  tenderId: string | null;
  dom: DomContextNode[];
  history: { role: 'user' | 'ai'; text: string }[];
}

export interface AssistantResponse {
  message: string;
  highlight_selector: string | null;
  /** A page of the app to open before pointing (the server only returns real paths). */
  navigate_to?: string | null;
  agent: AgentId;
}

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

export async function postAssistant(req: AssistantRequest): Promise<AssistantResponse> {
  if (USE_MOCK) return mockAssistantReply(req);
  const res = await askAssistant(req);
  return { ...res, agent: res.agent as AgentId };
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
 */
