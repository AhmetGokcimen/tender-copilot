'use server';

import { extractText, getDocumentProxy } from 'unpdf';
import { signedIn } from '@/lib/server-auth';

/**
 * Document agent: reads an uploaded certificate, authorization, balance
 * sheet or acceptance report and pulls out the facts tenders check. PDF
 * text is extracted on the server; the Meta model (when META_API_KEY is
 * set) reads that text, or the image itself for scans and photos. Without
 * a key, a rule-based reader handles text PDFs (types, numbers, dates,
 * ANRE classes, ISO standards, turnover). Every value is shown to the user
 * to confirm before it is saved.
 */

export type DocType =
  | 'anre_attestation'
  | 'anre_gas'
  | 'iscir'
  | 'igsu'
  | 'igpr'
  | 'afer'
  | 'iso'
  | 'company_certificate'
  | 'balance_sheet'
  | 'acceptance_report'
  | 'reference'
  | 'rte'
  | 'other';

export type ScannedDocument = {
  doc_type: DocType;
  title: string | null;
  issuer: string | null;
  number: string | null;
  holder: string | null;
  holder_cui: string | null;
  type_class: string | null;
  standard: string | null;
  scope: string | null;
  issued_on: string | null;
  expires_on: string | null;
  caen_codes: string[];
  balance: { year: number | null; turnover: number | null; currency: string | null } | null;
  contract: {
    title: string | null;
    client: string | null;
    value: number | null;
    currency: string | null;
    completed_on: string | null;
  } | null;
  method: 'ai' | 'rules';
  pages: number;
  /** Which fields were found, in reading order, for the progress view. */
  found: string[];
};

export type DocumentScanResult = { status: 'ok'; doc: ScannedDocument } | { status: 'unreadable' | 'too_large' | 'unsupported' };

const MAX_BYTES = 15 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Rule-based reader                                                   */
/* ------------------------------------------------------------------ */

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const MONTHS: Record<string, number> = {
  ian: 1, feb: 2, mar: 3, apr: 4, mai: 5, iun: 6, iul: 7, aug: 8, sep: 9, oct: 10, noi: 11, dec: 12,
  jan: 1, may: 5, jun: 6, jul: 7, nov: 11,
};

/** Dates as written in Romanian documents → ISO "YYYY-MM-DD". */
function parseDate(raw: string): string | null {
  const s = fold(raw).trim();
  let m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MONTHS[m[2]]) return iso(+m[3], MONTHS[m[2]], +m[1]);
  return null;
}
const iso = (y: number, mo: number, d: number) =>
  y > 1950 && y < 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31
    ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : null;

const DATE = String.raw`(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[a-zăâîșț]{3,}\.?\s+\d{4})`;

function after(text: string, labels: string, pattern = DATE): string | null {
  const re = new RegExp(`(?:${labels})[^\\n\\d]{0,40}?${pattern}`, 'i');
  return text.match(re)?.[1] ?? null;
}

/** Romanian amounts: "1.234.567,89" or "1234567" → number. */
function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s/g, '');
  const n = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/[.,](?=\d{3}\b)/g, '');
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function detectType(t: string): DocType {
  const f = fold(t);
  if (/autoritatea nationala de reglementare in domeniul energiei|\banre\b/.test(f)) {
    return /gaze naturale|\bedib\b|\bedsb\b|\bpdib\b/.test(f) ? 'anre_gas' : 'anre_attestation';
  }
  if (/\biscir\b|instalatiilor de ridicat|recipientelor sub presiune/.test(f)) return 'iscir';
  if (/situatii de urgenta|\bigsu\b|\bisu\b/.test(f) && /incendi/.test(f)) return 'igsu';
  if (/inspectoratul general al politiei|\bigpr\b|legea (nr\.?\s*)?333/.test(f)) return 'igpr';
  if (/autoritatea feroviara|\bafer\b/.test(f)) return 'afer';
  if (/iso\s*(9001|14001|45001|27001|50001|3834)/.test(f)) return 'iso';
  if (/certificat constatator|registrul comertului|\bonrc\b/.test(f)) return 'company_certificate';
  if (/bilant|situatii financiare|cifra de afaceri neta/.test(f)) return 'balance_sheet';
  if (/proces[- ]verbal de receptie/.test(f)) return 'acceptance_report';
  if (/responsabil tehnic cu executia/.test(f)) return 'rte';
  if (/recomandare|referinta|scrisoare de/.test(f)) return 'reference';
  return 'other';
}

function readByRules(text: string, pages: number): ScannedDocument {
  const doc_type = detectType(text);
  const found: string[] = ['doc_type'];
  const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 6 && l.length < 140) ?? null;

  const issued = after(text, 'data emiterii|emis(?:a|ă)? (?:la|in|în) data de|eliberat(?:a|ă)? (?:la|in|în)|din data de|data:?|issued on|date of issue');
  const expires = after(
    text,
    'valabil(?:a|ă|e)?\\s*(?:p[aâ]n[aă]\\s*(?:la|în|in)?|until)|data expir[aă]rii|expir[aă] la|valid until|expiry date|termen de valabilitate',
  );
  const number =
    text.match(/\b(?:nr\.?|num[aă]r(?:ul)?|no\.?|certificate no\.?|seria)\s*:?\s*([A-Z0-9][A-Z0-9/\-.]{1,24})/i)?.[1] ?? null;
  const cui = text.match(/\b(?:CUI|C\.U\.I\.|cod (?:unic )?de identificare(?: fiscal[aă])?)\s*:?\s*(RO\s?\d{2,10}|\d{2,10})/i)?.[1] ?? null;
  const holder =
    text.match(/\b((?:S\.?C\.?\s+)?[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ0-9 &.\-]{2,60}\s+S\.?R\.?L\.?|[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ0-9 &.\-]{2,60}\s+S\.?A\.?)\b/)?.[1]?.trim() ?? null;
  const anreClass = /anre/.test(doc_type)
    ? (text.match(/\btip(?:ul)?\s*:?\s*((?:A[1-3]?|B[pei]?|C1[AB]|C2[AB]|D[12]|E[12](?:MT|PA)?|EDIB|EDSB|PDIB|PDSB|IS|ID)(?:\s*,\s*(?:A[1-3]?|B[pei]?|C1[AB]|C2[AB]|D[12]|E[12](?:MT|PA)?))*)\b/i)?.[1] ?? null)
    : null;
  const standard = text.match(/\b(ISO(?:\/IEC)?\s*\d{4,5}(?::\d{4})?|SR EN (?:ISO )?\d{3,5}(?::\d{4})?)/i)?.[1]?.replace(/\s+/g, ' ') ?? null;
  const scope = after(text, 'domeniul de aplicare|domeniu(?:l)? certificat|scope(?: of certification)?|pentru activitatea de|activitate(?:a|ile)?\\s*:', '([^\\n]{8,220})');
  const caen = [...new Set([...text.matchAll(/\b(?:CAEN|cod CAEN)\s*:?\s*(\d{4})\b/gi)].map((m) => m[1]))];

  let balance: ScannedDocument['balance'] = null;
  if (doc_type === 'balance_sheet') {
    const year = Number(text.match(/(?:exercitiul financiar|anul|31\.12\.)\s*(\d{4})/i)?.[1]) || null;
    const raw = text.match(/cifra de afaceri net[aă][^\d\n]{0,40}([\d .,]{4,})/i)?.[1];
    balance = { year, turnover: raw ? parseAmount(raw) : null, currency: 'RON' };
    if (balance.year) found.push('balance_year');
    if (balance.turnover !== null) found.push('balance_turnover');
  }

  let contract: ScannedDocument['contract'] = null;
  if (doc_type === 'acceptance_report' || doc_type === 'reference') {
    const value = text.match(/valoare[a]?(?: total[aă])?(?: f[aă]r[aă] TVA)?[^\d\n]{0,30}([\d .,]{4,})\s*(lei|ron|eur|euro)?/i);
    const client = text.match(/(?:beneficiar(?:ul)?|autoritatea contractant[aă])\s*:?\s*([^\n,]{3,90})/i)?.[1]?.trim() ?? null;
    const titleLine = text.match(/(?:obiectiv(?:ul)?|lucrarea|denumirea lucr[aă]rii|contract(?:ul)? (?:de lucr[aă]ri )?nr\.[^\n]*privind)\s*:?\s*["„]?([^\n"”]{6,160})/i)?.[1]?.trim() ?? null;
    const completed = after(text, 'data recep[tț]iei|recep[tț]ia la terminarea lucr[aă]rilor[^\\n]{0,40}?din|încheiat(?:ă)? (?:azi|ast[aă]zi)');
    contract = {
      title: titleLine,
      client,
      value: value ? parseAmount(value[1]) : null,
      currency: value?.[2] ? (/eur/i.test(value[2]) ? 'EUR' : 'RON') : null,
      completed_on: completed ? parseDate(completed) : issued ? parseDate(issued) : null,
    };
    if (contract.title) found.push('contract_title');
    if (contract.client) found.push('contract_client');
    if (contract.value !== null) found.push('contract_value');
  }

  const out: ScannedDocument = {
    doc_type,
    title: firstLine,
    issuer: null,
    number,
    holder,
    holder_cui: cui ? cui.replace(/\s/g, '') : null,
    type_class: anreClass?.toUpperCase() ?? null,
    standard,
    scope: scope?.replace(/^[\s:\-–]+/, '').trim() || null,
    issued_on: issued ? parseDate(issued) : null,
    expires_on: expires ? parseDate(expires) : null,
    caen_codes: caen,
    balance,
    contract,
    method: 'rules',
    pages,
    found,
  };
  const ISSUERS: Partial<Record<DocType, string>> = {
    anre_attestation: 'ANRE', anre_gas: 'ANRE', iscir: 'ISCIR', igsu: 'IGSU', igpr: 'IGPR', afer: 'AFER',
    company_certificate: 'ONRC', balance_sheet: 'ANAF', rte: 'ISC / MDLPA',
  };
  out.issuer = ISSUERS[doc_type] ?? null;
  for (const k of ['issuer', 'number', 'holder', 'holder_cui', 'type_class', 'standard', 'scope', 'issued_on', 'expires_on'] as const) {
    if (out[k]) found.push(k);
  }
  if (caen.length) found.push('caen_codes');
  return out;
}

/* ------------------------------------------------------------------ */
/* Model reader                                                        */
/* ------------------------------------------------------------------ */

const SYSTEM = `You read Romanian business documents for a public-procurement tool: authorizations (ANRE, ISCIR, IGSU, IGPR, AFER), ISO certificates, the trade-registry certificate (certificat constatator), balance sheets, acceptance reports (proces-verbal de recepție) and reference letters.
Extract only what the document states. Never guess a date, number or class. Use null when a field is not present.
Dates as YYYY-MM-DD. Amounts as plain numbers without thousands separators. type_class is the authorization grade or type (for ANRE e.g. "B", "C2A", "EDIB").
Answer as JSON with exactly these keys:
{"doc_type": one of ["anre_attestation","anre_gas","iscir","igsu","igpr","afer","iso","company_certificate","balance_sheet","acceptance_report","reference","rte","other"],
 "title": string|null, "issuer": string|null, "number": string|null, "holder": string|null, "holder_cui": string|null,
 "type_class": string|null, "standard": string|null, "scope": string|null, "issued_on": string|null, "expires_on": string|null,
 "caen_codes": string[],
 "balance": {"year": number|null, "turnover": number|null, "currency": string|null} | null,
 "contract": {"title": string|null, "client": string|null, "value": number|null, "currency": string|null, "completed_on": string|null} | null}`;

async function readWithModel(input: { text?: string; image?: { mime: string; b64: string } }): Promise<Omit<ScannedDocument, 'method' | 'pages' | 'found'> | null> {
  const key = process.env.META_API_KEY;
  if (!key) return null;
  const base = process.env.META_API_BASE_URL || 'https://api.meta.ai/v1';
  const content: Record<string, string>[] = [
    { type: 'input_text', text: input.text ? `Document text:\n${input.text.slice(0, 30_000)}` : 'The document is the attached image.' },
  ];
  if (input.image) content.push({ type: 'input_image', image_url: `data:${input.image.mime};base64,${input.image.b64}` });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`${base}/responses`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.META_MODEL || 'muse-wonder-1.0',
        instructions: SYSTEM,
        input: [{ role: 'user', content }],
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
    const p = JSON.parse(out);
    const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null);
    const d = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const TYPES: DocType[] = ['anre_attestation', 'anre_gas', 'iscir', 'igsu', 'igpr', 'afer', 'iso', 'company_certificate', 'balance_sheet', 'acceptance_report', 'reference', 'rte', 'other'];
    return {
      doc_type: TYPES.includes(p.doc_type) ? p.doc_type : 'other',
      title: s(p.title),
      issuer: s(p.issuer),
      number: s(p.number),
      holder: s(p.holder),
      holder_cui: s(p.holder_cui),
      type_class: s(p.type_class),
      standard: s(p.standard),
      scope: s(p.scope),
      issued_on: d(p.issued_on),
      expires_on: d(p.expires_on),
      caen_codes: Array.isArray(p.caen_codes) ? p.caen_codes.filter((c: unknown) => typeof c === 'string' && /^\d{4}$/.test(c)) : [],
      balance: p.balance && typeof p.balance === 'object' ? { year: n(p.balance.year), turnover: n(p.balance.turnover), currency: s(p.balance.currency) } : null,
      contract:
        p.contract && typeof p.contract === 'object'
          ? { title: s(p.contract.title), client: s(p.contract.client), value: n(p.contract.value), currency: s(p.contract.currency), completed_on: d(p.contract.completed_on) }
          : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const FIELD_ORDER = ['doc_type', 'issuer', 'number', 'holder', 'holder_cui', 'type_class', 'standard', 'scope', 'issued_on', 'expires_on', 'caen_codes'] as const;

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function scanDocument(form: FormData): Promise<DocumentScanResult> {
  // The signed-in browser sends its Supabase access token with the file.
  if (!(await signedIn(form.get('access_token')))) return { status: 'unreadable' };
  const file = form.get('file');
  if (!(file instanceof File)) return { status: 'unsupported' };
  if (file.size > MAX_BYTES) return { status: 'too_large' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage = /^image\/(png|jpe?g|webp)$/.test(file.type);
  if (!isPdf && !isImage) return { status: 'unsupported' };

  let text = '';
  let pages = 1;
  if (isPdf) {
    try {
      const pdf = await getDocumentProxy(bytes);
      const out = await extractText(pdf, { mergePages: true });
      text = String(out.text ?? '');
      pages = out.totalPages;
    } catch {
      return { status: 'unreadable' };
    }
  }

  const hasText = text.replace(/\s/g, '').length > 60;
  const ai = await readWithModel(
    hasText ? { text } : isImage ? { image: { mime: file.type, b64: Buffer.from(bytes).toString('base64') } } : {},
  );
  if (ai) {
    const found = FIELD_ORDER.filter((k) => {
      const v = ai[k];
      return Array.isArray(v) ? v.length > 0 : v !== null;
    }) as string[];
    if (ai.balance?.turnover != null) found.push('balance_turnover');
    if (ai.contract?.value != null) found.push('contract_value');
    return { status: 'ok', doc: { ...ai, method: 'ai', pages, found } };
  }
  // Scanned PDFs and photos need the model; text PDFs work without it.
  if (!hasText) return { status: 'unreadable' };
  return { status: 'ok', doc: readByRules(text, pages) };
}
