/**
 * Mock assistant engine: deterministic intent matching over the question,
 * tender file and current route. Returns the same structured contract as
 * the real backend (`message` + `highlight_selector` + `agent`) using only
 * stable `[data-assistant]` hooks — never raw DOM paths.
 */
import { fetchTender } from './api';
import type { TenderWithState } from './types';
import type { DomContextNode } from './dom-context';
import type { AssistantRequest, AssistantResponse } from './assistant-api';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CAPABILITIES =
  'I can check eligibility for the tender you are viewing, explain match scores and missing documents, help you draft and revise offer documents, and guide you around the app. Try: "Am I eligible for this tender?"';

const DEICTIC_RE =
  /(show me|where is|where's|where are|point to|point at|take me to|go to|göster|goster|nerede|nerde|nereye)\b/i;

const STOPWORDS = new Set([
  'show', 'me', 'the', 'a', 'an', 'on', 'screen', 'page', 'this', 'that', 'these', 'those',
  'to', 'where', 'what', 'is', 'are', 'was', 's', 'at', 'in', 'of', 'for', 'my', 'i', 'it',
  'point', 'take', 'please', 'pls', 'open', 'go', 'do', 'does', 'can', 'you', 'your',
  'button', 'section', 'tab', 'link', 'menu', 'part', 'area', 'field', 'box',
  'göster', 'goster', 'gösterin', 'nerede', 'nerde', 'nereye', 'nereyi', 'bana', 'beni', 'şunu', 'bunu', 'şu', 'bu',
  'lütfen', 'mi', 'mı', 'mu', 'mü', 'bir', 've', 'ile',
]);

function extractTokens(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Hook values are the selector whitelist: strict shape, never user text. */
function isHookShape(hook: string): boolean {
  return /^[a-z0-9-]{2,40}$/i.test(hook);
}

/** Strip icon-ligature prefixes ("grid_viewSEAP…") for human labels. */
function cleanLabel(text: string, hook: string): string {
  const cleaned = text
    .replace(/^[a-z]+(?:_[a-z]+)+\s*/, '')
    .replace(/^[a-z]+(?=[A-Z])/, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return cleaned || hook;
}

interface HookMatch {
  hook: string;
  label: string;
  score: number;
}

function matchHookedCandidate(tokens: string[], dom: DomContextNode[]): HookMatch | null {
  let best: HookMatch | null = null;
  for (const n of dom) {
    if (!n.hook || !isHookShape(n.hook)) continue;
    const parts = n.hook.toLowerCase().split('-');
    const text = n.text.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (parts.includes(tok)) score += 3;
      else if (tok.length >= 4 && parts.some((p) => p.includes(tok))) score += 2;
      else if (tok.length >= 3 && text.includes(tok)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { hook: n.hook, label: cleanLabel(n.text, n.hook), score };
    }
  }
  return best;
}

function hookedOptions(dom: DomContextNode[], limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of dom) {
    if (!n.hook || !isHookShape(n.hook) || seen.has(n.hook)) continue;
    seen.add(n.hook);
    out.push(`"${cleanLabel(n.text, n.hook)}"`);
    if (out.length >= limit) break;
  }
  return out;
}

async function loadTender(tenderId: string | null): Promise<TenderWithState | undefined> {
  if (!tenderId) return undefined;
  try {
    return await fetchTender(tenderId);
  } catch {
    return undefined;
  }
}

export async function mockAssistantReply(req: AssistantRequest): Promise<AssistantResponse> {
  await delay(900);
  const q = req.question.toLowerCase();
  const tender = await loadTender(req.tenderId);
  const onTenderDetail = req.pathname.includes('/app/tenders/');
  const short = tender
    ? (tender.state.ai_title_simplified ?? tender.title).slice(0, 60)
    : '';

  // Greetings / capabilities.
  if (/^(hi|hello|hey|thanks|thank you)\b/.test(q) || /what can you do|help|how does .* work/.test(q)) {
    return { agent: 'writer', highlight_selector: null, message: `Hi! ${CAPABILITIES}` };
  }

  // Draft / generate / DUAE / offer.
  if (/(draft|generat|duae|offer|proposal)/.test(q)) {
    if (tender) {
      const gaps = tender.state.unmet_requirements.length + tender.state.missing_documents.length;
      return {
        agent: 'writer',
        highlight_selector: '[data-assistant="tender-generate"]',
        message:
          `To draft an offer for "${short}", press Generate documents in the Offer documents section below — the agents assemble the technical offer, financials and DUAE from your company archive. ` +
          (gaps > 0
            ? `Note: ${gaps} open gap${gaps === 1 ? '' : 's'} will be flagged for your review.`
            : 'The file is complete, so the draft should come out clean.'),
      };
    }
    if (onTenderDetail) {
      return {
        agent: 'writer',
        highlight_selector: '[data-assistant="tender-generate"]',
        message:
          'Tick the documents you need, then press Generate documents. Five specialist agents assemble the sections — each one labeled by its author.',
      };
    }
    return {
      agent: 'writer',
      highlight_selector: '[data-assistant="tender-card"]',
      message:
        'Open any tender to draft for it: its analysis page has an Offer documents section where the agents write the technical offer, financials and DUAE from your company archive.',
    };
  }

  // Eligibility / qualification.
  if (/(eligib|qualif|can i bid|do i qualify|should i bid)/.test(q)) {
    if (tender) {
      const v = tender.state.eligible;
      const verdict =
        v === true
          ? `Yes — "${short}" looks eligible (${tender.state.matched_requirements.length} requirements matched).`
          : v === false
            ? `Not this one — ${tender.state.unmet_requirements.length} requirement${tender.state.unmet_requirements.length === 1 ? '' : 's'} unmet.`
            : 'Uncertain — the file is missing proof for some criteria, so I will not guess. Verify the flagged items first.';
      return {
        agent: 'eligibility',
        highlight_selector: '[data-assistant="eligibility-card"]',
        message: `${verdict} The full justification and evidence are in the eligibility analysis.`,
      };
    }
    return {
      agent: 'eligibility',
      highlight_selector: '[data-assistant="tender-card"]',
      message:
        'Open any opportunity to see its eligibility verdict with reasons. Green means eligible, red means not eligible, gray means the file is unclear.',
    };
  }

  // Gaps / missing documents / risk.
  if (/(missing|gap|risk|document|certificate)/.test(q)) {
    if (tender) {
      const items = [...tender.state.unmet_requirements, ...tender.state.missing_documents];
      return {
        agent: 'risk',
        highlight_selector: '[data-assistant="unmet-box"]',
        message:
          items.length === 0
            ? `No open gaps on "${short}" — the file is complete.`
            : `Open items on "${short}": ${items.slice(0, 4).join('; ')}${items.length > 4 ? `, plus ${items.length - 4} more` : ''}.`,
      };
    }
    return {
      agent: 'risk',
      highlight_selector: '[data-assistant="tender-card"]',
      message:
        'Open a tender to see its gaps and missing documents. Your certificates live under Archive & Certificates.',
    };
  }

  // Legal / exclusion / declarations.
  if (/(legal|exclusion|declaration|compliance)/.test(q)) {
    return {
      agent: 'legal',
      highlight_selector: tender
        ? '[data-assistant="tender-generate"]'
        : '[data-assistant="tender-card"]',
      message:
        'Exclusion grounds and declarations are covered by the DUAE self-declaration — open the tender and press Generate documents, and the Legal Reviewer drafts that section from your company record.',
    };
  }

  // Requirements / spec / criteria.
  if (/(requirement|spec|criteria|criterion)/.test(q)) {
    if (tender) {
      return {
        agent: 'spec',
        highlight_selector: '[data-assistant="requirements-card"]',
        message: `"${short}" has ${tender.state.extracted_requirements.length} extracted requirements, listed with the matched ones checked against your profile.`,
      };
    }
    return {
      agent: 'spec',
      highlight_selector: '[data-assistant="tender-card"]',
      message: 'Open any tender to see the requirements the Spec Analyst extracted from its file.',
    };
  }

  // Score / match.
  if (/(score|match|percent|rating)/.test(q)) {
    if (tender) {
      const reasons = tender.state.score_reasons.slice(0, 2).join(' ');
      return {
        agent: 'eligibility',
        highlight_selector: '[data-assistant="score-card"]',
        message: `"${short}" scores ${tender.state.score ?? '—'}%. ${reasons}`,
      };
    }
    return {
      agent: 'eligibility',
      highlight_selector: '[data-assistant="tender-card"]',
      message:
        'The navy score chip ranks each tender 0–100 from CPV fit, capacity and history. Solid navy means 85% or higher.',
    };
  }

  // Navigation intents.
  if (/(pipeline|kanban|track|submit|submission|status)/.test(q)) {
    return {
      agent: 'writer',
      highlight_selector: req.pathname.includes('/app/pipeline')
        ? '[data-assistant="pipeline-board"]'
        : '[data-assistant="nav-pipeline"]',
      message:
        'The bidding pipeline tracks every opportunity from identified to submitted. Drag cards between stages; removing a card untracks it.',
    };
  }
  if (/(setting|company|profile|cui)/.test(q)) {
    return {
      agent: 'writer',
      highlight_selector: '[data-assistant="nav-settings"]',
      message:
        'Your company profile — name, CUI, CPV codes, capacity and certifications — drives matching, eligibility and drafts. Keep it current.',
    };
  }
  if (/(archive|certificate|result|won|lost|award)/.test(q)) {
    return {
      agent: 'writer',
      highlight_selector: '[data-assistant="nav-archive"]',
      message:
        'Archive & Certificates holds submission results plus the fiscal certificates attached to generated offers. Expired ones are flagged red.',
    };
  }
  if (/(find|search|opportunit|browse|list|feed)/.test(q)) {
    const onList = /^\/app\/?$/.test(req.pathname);
    return {
      agent: 'writer',
      highlight_selector: onList ? '[data-assistant="filters-search"]' : '[data-assistant="nav-opportunities"]',
      message: onList
        ? 'Use the search and filters to narrow the feed — county, procedure, value, CPV prefix and minimum score all apply live.'
        : 'New tenders land in SEAP Opportunities, ranked by AI match score with an eligibility verdict on each card.',
    };
  }

  // Deictic ("show me X") layer: point at UI using the collected DOM hooks.
  // Runs after the rich keyword intents, so tender-aware answers keep priority.
  // Injection note: selectors are built ONLY from validated hook values —
  // never from user text or raw DOM strings. User text only scores matches
  // via substring checks; no RegExp is ever built from it.
  const hasDeictic = DEICTIC_RE.test(q);
  const tokens = extractTokens(q);
  const bareFollowUp = !hasDeictic && tokens.length > 0 && tokens.length <= 3;
  if (hasDeictic || bareFollowUp) {
    const match = tokens.length > 0 ? matchHookedCandidate(tokens, req.dom) : null;
    if (match && (hasDeictic || match.score >= 3)) {
      return {
        agent: 'writer',
        highlight_selector: `[data-assistant="${match.hook}"]`,
        message: `Here's "${match.label}" — I've highlighted it on the screen.`,
      };
    }
    if (hasDeictic) {
      const options = hookedOptions(req.dom);
      return {
        agent: 'writer',
        highlight_selector: null,
        message:
          options.length > 0
            ? `Which section should I show you: ${options.join(', ')}?`
            : 'Which section should I show you? Name what you are looking for.',
      };
    }
  }

  // Fallback.
  return {
    agent: 'writer',
    highlight_selector: null,
    message: `I'm not sure how to help with that yet. ${CAPABILITIES}`,
  };
}
