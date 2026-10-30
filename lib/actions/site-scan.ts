'use server';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { TRADES } from '@/lib/construction';

/**
 * Website agent for onboarding. Reads the company's site server-side (the
 * home page plus the few internal pages most likely to describe its work),
 * then maps what it read onto the construction catalogue: which trades the
 * company works in and which works (CPV codes) it does, each with the
 * sentence that gave it away.
 *
 * Classification uses the Meta model when META_API_KEY is set, and falls
 * back to a phrase matcher over the catalogue otherwise (or when the model
 * call fails), so onboarding never blocks on the agent. Every suggestion is
 * checked against the catalogue; the user confirms on the next step.
 */

export type ScanPick = { cpv: string; trade: string; evidence: string };
export type ScanResult =
  | {
      status: 'ok';
      method: 'ai' | 'keywords';
      pages: { url: string; title: string }[];
      summary: string;
      picks: ScanPick[];
    }
  | { status: 'invalid' | 'unreachable' | 'empty' };

const MAX_PAGES = 5;
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_TEXT = 24_000;

/** Paths that usually describe what a construction company does. */
const LINK_HINTS =
  /servic|lucrar|activit|domen|despre|about|portofol|portfolio|proiect|project|referin|oferta|ce-facem|what-we-do|specializ|competen/i;

/* ------------------------------------------------------------------ */
/* Safe fetching                                                       */
/* ------------------------------------------------------------------ */

function privateAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return privateAddress(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Rejects non-web schemes and hosts that resolve to private networks. */
async function safeUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  // Local testing only: lets the scanner read a site served on localhost.
  if (process.env.SITE_SCAN_ALLOW_PRIVATE === '1') return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addrs.length === 0 || addrs.some((a) => privateAddress(a.address))) return null;
  } catch {
    return null;
  }
  return url;
}

/** GET with a timeout, a size cap, HTML only, and redirects re-checked. */
async function fetchPage(start: URL): Promise<{ url: URL; html: string } | null> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'LicitsBot/1.0 (+https://licits.com; reads company sites during onboarding)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ro,en;q=0.8',
        },
        cache: 'no-store',
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get('location');
        const safe = next ? await safeUrl(new URL(next, url).toString()) : null;
        if (!safe) return null;
        url = safe;
        continue;
      }
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html') || !res.body) return null;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      return { url, html: new TextDecoder().decode(Buffer.concat(chunks)) };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Reading HTML                                                        */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);

function readPage(html: string, base: URL) {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const description = decode(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? '',
  ).trim();
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const href = new URL(m[1], base);
      const label = m[2].replace(/<[^>]+>/g, ' ');
      if (href.host === base.host && LINK_HINTS.test(`${href.pathname} ${label}`)) {
        href.hash = '';
        links.add(href.toString());
      }
    } catch {
      /* not a URL */
    }
  }
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '. ')
      .replace(/<br\s*\/?>/gi, '. ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .trim();
  return { title, text: [description, text].filter(Boolean).join('. '), links: [...links] };
}

/* ------------------------------------------------------------------ */
/* Matching onto the catalogue                                         */
/* ------------------------------------------------------------------ */

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
const STOP = new Set(['de', 'si', 'pentru', 'la', 'in', 'cu', 'pe', 'din', 'a', 'al', 'the', 'and', 'of', 'for', 'on', 'with', 'or', 'si/sau']);
const stems = (phrase: string) =>
  fold(phrase)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    // Short words must match whole ("dig" is not "digital"); longer ones
    // drop their last letters so endings vary ("asfaltare" finds
    // "asfaltari") but stems stay apart ("proiectare" is not "proiecte").
    .map((w) => (w.length <= 5 ? `${w} ` : w.slice(0, Math.min(8, Math.max(5, w.length - 2)))));

const CATALOGUE = TRADES.flatMap((trade) =>
  trade.works.map((work) => ({
    cpv: work.cpv,
    trade: trade.key,
    label: `${work.name.ro} / ${work.name.en}`,
    phrases: [work.name.ro, work.name.en, ...(work.kw ? work.kw.split(',') : [])]
      .map(stems)
      .filter((p) => p.length > 0),
  })),
);

/** Sentence-level phrase matching: every stem of a phrase in one sentence. */
function matchKeywords(text: string): ScanPick[] {
  const sentences = text.split(/(?<=[.!?;])\s+|\s[•|·]\s/).filter((s) => s.length > 12 && s.length < 600);
  const folded = sentences.map((s) => ` ${fold(s).replace(/[^a-z0-9]+/g, ' ')} `);
  const picks: ScanPick[] = [];
  const seen = new Set<string>();
  for (const item of CATALOGUE) {
    let best = -1;
    let hits = 0;
    for (let i = 0; i < folded.length; i++) {
      const s = folded[i];
      if (item.phrases.some((p) => p.every((stem) => s.includes(` ${stem}`)))) {
        hits++;
        if (best < 0) best = i;
      }
    }
    // One-word phrases are noisier, so they need two sentences to count.
    const singleWord = item.phrases.every((p) => p.length === 1);
    if (hits >= (singleWord ? 2 : 1) && !seen.has(item.cpv)) {
      seen.add(item.cpv);
      picks.push({ cpv: item.cpv, trade: item.trade, evidence: sentences[best].slice(0, 180) });
    }
  }
  return picks;
}

const SYSTEM = `You read a Romanian construction company's website and map the work it does onto a fixed catalogue of construction works.
Rules:
- Only pick works the site clearly says the company does itself. Never pick a work because it is merely mentioned, a client name, or a product the company sells without installing.
- Use only CPV codes from the catalogue you are given. Never invent codes.
- For each pick, quote the shortest sentence from the site that shows it (in the site's language, at most 180 characters).
- Also write a one-sentence summary of what the company does, in the requested language.
Answer as JSON: {"summary": string, "picks": [{"cpv": string, "evidence": string}]}`;

async function matchWithModel(text: string, lang: 'en' | 'ro'): Promise<{ summary: string; picks: ScanPick[] } | null> {
  const key = process.env.META_API_KEY;
  if (!key) return null;
  const base = process.env.META_API_BASE_URL || 'https://api.meta.ai/v1';
  const catalogue = CATALOGUE.map((c) => `${c.cpv} | ${c.trade} | ${c.label}`).join('\n');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(`${base}/responses`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.META_MODEL || 'muse-wonder-1.0',
        instructions: SYSTEM,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Summary language: ${lang === 'ro' ? 'Romanian' : 'English'}\n\nCatalogue (cpv | trade | name):\n${catalogue}\n\nWebsite text:\n${text}`,
              },
            ],
          },
        ],
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_object' } },
        stream: false,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = (data.output ?? [])
      .filter((o: { type?: string }) => o.type === 'message')
      .flatMap((o: { content?: { type?: string; text?: string }[] }) => o.content ?? [])
      .find((c: { type?: string }) => c.type === 'output_text')?.text;
    if (!out) return null;
    const parsed = JSON.parse(out) as { summary?: unknown; picks?: { cpv?: unknown; evidence?: unknown }[] };
    const byCpv = new Map(CATALOGUE.map((c) => [c.cpv, c]));
    const picks: ScanPick[] = [];
    for (const p of Array.isArray(parsed.picks) ? parsed.picks : []) {
      const item = typeof p.cpv === 'string' ? byCpv.get(p.cpv) : undefined;
      if (item && !picks.some((x) => x.cpv === item.cpv)) {
        picks.push({ cpv: item.cpv, trade: item.trade, evidence: String(p.evidence ?? '').slice(0, 180) });
      }
    }
    return { summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 300) : '', picks };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function scanCompanySite(rawUrl: string, lang: 'en' | 'ro' = 'en'): Promise<ScanResult> {
  const start = await safeUrl(String(rawUrl ?? '').trim().slice(0, 300));
  if (!start) return { status: 'invalid' };

  const home = await fetchPage(start);
  if (!home) return { status: 'unreachable' };
  const first = readPage(home.html, home.url);
  const pages = [{ url: home.url.toString(), title: first.title }];
  const texts = [first.text];

  const extra = (await Promise.all(
    first.links
      .filter((l) => l !== home.url.toString())
      .slice(0, MAX_PAGES - 1)
      .map(async (link) => {
        const safe = await safeUrl(link);
        return safe ? fetchPage(safe) : null;
      }),
  )).filter((p): p is { url: URL; html: string } => p !== null);
  for (const page of extra) {
    const read = readPage(page.html, page.url);
    pages.push({ url: page.url.toString(), title: read.title });
    texts.push(read.text);
  }

  const text = texts.join('\n\n').slice(0, MAX_TEXT);
  if (text.replace(/\W/g, '').length < 80) return { status: 'empty' };

  const ai = await matchWithModel(text, lang);
  if (ai && ai.picks.length > 0) return { status: 'ok', method: 'ai', pages, summary: ai.summary, picks: ai.picks };
  return { status: 'ok', method: 'keywords', pages, summary: first.title, picks: matchKeywords(text) };
}
