/**
 * Assembles the three bid documents from the agents' outputs, the company
 * profile and the tender. Layouts follow the forms Romanian contracting
 * authorities publish in their award documentation:
 *
 *  - Propunere tehnică: identification, understanding of the requirement,
 *    methodology, work plan, resources, quality/HSE, the compliance table
 *    (Nr. crt. | Cerință din caietul de sarcini | Răspuns ofertant | Conform),
 *    declarations, annexes, signature.
 *  - Propunere financiară: Formular de ofertă (the binding offer letter),
 *    the price centralizer (Nr. crt. | Denumire | U.M. | Cantitate | Preț
 *    unitar | Valoare, then total, TVA and total with TVA) and commercial
 *    conditions. Bid prices are left for the company to enter: pricing is its
 *    decision, and nothing here invents one.
 *  - DUAE: the European Single Procurement Document, Parts I-VI in the
 *    official order. Only facts the company profile states are filled in;
 *    the exclusion-ground answers are marked for the company to confirm.
 *
 * Documents are in Romanian, the language bids are submitted in. Values the
 * data does not give are shown as "[de completat]" for the operator.
 */
import type { CompanyProfile, DraftSection, EvidenceDocument, TenderWithState } from './types';
import type { DocType } from '@/stores/useGeneratorStore';
import type { AgentOutputs } from './agents';
import { computePricing, parseNumber, type BidInputs } from './bid-inputs';

export const DOC_TITLES: Record<DocType, string> = {
  technical: 'Technical offer',
  financial: 'Financial offer',
  duae: 'DUAE — European Single Procurement Document',
};

/** Titles as they appear on the submitted document. */
export const DOC_TITLES_RO: Record<DocType, string> = {
  technical: 'PROPUNERE TEHNICĂ',
  financial: 'PROPUNERE FINANCIARĂ',
  duae: 'DOCUMENTUL UNIC DE ACHIZIȚIE EUROPEAN (DUAE)',
};

/** What the draft builders need beyond the agents' output: the company's own answers and the VAT rate in force. */
export interface DraftContext {
  agents: AgentOutputs;
  inputs?: BidInputs;
  vatRate: number;
}

const BLANK = '[de completat]';
const DOTS = '………………';

export function roDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return DOTS;
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function roMoney(value: number | null | undefined, currency = 'lei'): string {
  if (value === null || value === undefined) return BLANK;
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

/** Table cells must stay on one line and free of pipes. */
function cell(text: string | null | undefined): string {
  const t = (text ?? '').replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();
  return t === '' ? '—' : t;
}

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n');
}

function bullets(items: string[]): string {
  const list = items.filter((x) => x && x.trim() !== '');
  return list.length > 0 ? list.map((r) => `- ${r}`).join('\n') : '- Nu este cazul.';
}

const cpvLine = (tender: TenderWithState) => (tender.cpv_codes.length > 0 ? tender.cpv_codes.join(', ') : BLANK);

const tenderTitle = (tender: TenderWithState) => tender.title;

/** Markdown front matter for copy-to-clipboard (the PDF renders its own header block). */
export function draftFrontMatter(tender: TenderWithState, company: CompanyProfile, doc: DocType): string {
  return [
    `# ${DOC_TITLES_RO[doc]}`,
    '',
    `**Operator economic:** ${company.name} (CUI ${company.cui})`,
    `**Autoritate contractantă:** ${tender.authority}`,
    `**Procedura:** ${tender.external_id} — ${tenderTitle(tender)}`,
    `**Data:** ${roDate()} | **Stare:** PROIECT, de verificat înainte de depunere`,
    '',
  ].join('\n');
}

function identityTable(tender: TenderWithState, company: CompanyProfile): string {
  return table(
    ['Câmp', 'Date'],
    [
      ['Operator economic (ofertant)', `**${company.name}**`],
      ['Cod unic de înregistrare (CUI)', company.cui],
      ['Autoritate contractantă', tender.authority],
      ['Obiectul achiziției', tenderTitle(tender)],
      ['Cod CPV principal', cpvLine(tender)],
      ['Nr. anunț SEAP', tender.external_id],
      ['Termen limită de depunere', roDate(tender.submission_deadline)],
    ],
  );
}

function signature(company: CompanyProfile, inputs?: BidInputs): string {
  const who = inputs?.repName.trim()
    ? `${inputs.repName.trim()}${inputs.repRole.trim() ? `, ${inputs.repRole.trim()}` : ''}`
    : null;
  return table(
    ['Data completării', `Ofertant: ${company.name}${who ? `, reprezentant: ${who}` : ''} (semnătura autorizată și ștampila)`],
    [[DOTS, DOTS]],
  );
}

const answer = (v: 'applies' | 'not_applies' | null) => (v === 'applies' ? 'DA' : v === 'not_applies' ? 'NU' : BLANK);
const yesNo = (v: 'yes' | 'no' | null) => (v === 'yes' ? 'DA' : v === 'no' ? 'NU' : BLANK);
const SIZE_RO = { micro: 'microîntreprindere', small: 'întreprindere mică', medium: 'întreprindere mijlocie', large: 'întreprindere mare' } as const;

function technicalOffer(
  tender: TenderWithState,
  company: CompanyProfile,
  evidence: EvidenceDocument[],
  ctx: DraftContext,
): DraftSection[] {
  const a = ctx.agents;
  const w = a.writer;
  const spec = a.spec;
  const brief = tender.brief?.ro;

  const understanding =
    w?.understanding?.trim() ||
    brief?.overview ||
    tender.raw_description ||
    `Obiectul achiziției este „${tenderTitle(tender)}”, pentru ${tender.authority}.`;

  const methodology =
    w && w.methodology.length > 0
      ? w.methodology.map((m, i) => `**${i + 1}. ${m.title}.** ${m.text}`).join('\n\n')
      : `Metodologia de execuție ${BLANK}. Agentul de redactare nu a putut genera acest capitol; completați-l pe baza caietului de sarcini.`;

  const plan =
    w && w.work_plan.length > 0
      ? table(
          ['Nr. crt.', 'Etapă', 'Activități principale', 'Durată'],
          w.work_plan.map((p, i) => [String(i + 1), p.phase, p.activities, p.duration || BLANK]),
        )
      : `Graficul de execuție ${BLANK}${spec?.duration ? ` (durata contractului indicată de autoritate: ${spec.duration})` : ''}.`;

  const certs = company.certifications;
  const resources = [
    w?.resources?.trim() || `Resursele umane și tehnice alocate contractului ${BLANK}.`,
    '',
    'Certificări și autorizări deținute de ofertant:',
    '',
    bullets(certs),
  ].join('\n');

  const compliance =
    w && w.compliance.length > 0
      ? w.compliance.map((c) => [c.ref, c.requirement, c.response, 'DA'])
      : (spec?.items ?? [])
          .filter((i) => i.category === 'technical')
          .map((i) => [i.ref, i.text, BLANK, BLANK]);
  const complianceBlock =
    compliance.length > 0
      ? table(['Nr. crt.', 'Cerință din caietul de sarcini', 'Răspunsul ofertantului', 'Conform'], compliance)
      : `Cerințele tehnice nu au putut fi extrase automat. Completați tabelul pe baza caietului de sarcini ${BLANK}.`;

  const declarations = a.legal?.declarations ?? [];

  const sections: DraftSection[] = [
    { agent: 'writer', title: '1. Date de identificare', body: identityTable(tender, company) },
    { agent: 'spec', title: '2. Înțelegerea cerințelor autorității contractante', body: understanding },
    { agent: 'writer', title: '3. Metodologia de execuție', body: methodology },
    { agent: 'writer', title: '4. Graficul de execuție', body: plan },
    { agent: 'eligibility', title: '5. Resurse și capacitate tehnică', body: resources },
  ];
  if (w?.quality_hse?.trim()) {
    sections.push({ agent: 'writer', title: '6. Managementul calității, mediului și securității muncii', body: w.quality_hse });
  }
  sections.push(
    { agent: 'spec', title: `${sections.length + 1}. Tabel de conformitate cu caietul de sarcini`, body: complianceBlock },
    {
      agent: 'legal',
      title: `${sections.length + 2}. Declarații`,
      body: bullets(
        declarations.length > 0
          ? declarations
          : [
              `Oferta este valabilă ${ctx.inputs?.validityDays.trim() || DOTS} zile de la data limită de depunere (${roDate(tender.submission_deadline)}), conform documentației de atribuire.`,
              'Respectăm obligațiile din domeniul mediului, social și al muncii (art. 51 din Legea nr. 98/2016).',
            ],
      ),
    },
    {
      agent: 'writer',
      title: `${sections.length + 3}. Anexe`,
      body: bullets(evidence.map((e) => `${e.name} (${e.type})`)),
    },
    { agent: 'writer', title: 'Semnătura', body: signature(company, ctx.inputs) },
  );
  return sections;
}

function financialOffer(tender: TenderWithState, company: CompanyProfile, ctx: DraftContext): DraftSection[] {
  const a = ctx.agents;
  const spec = a.spec;
  const items = a.writer?.price_items ?? [];
  const pricing = computePricing(items, ctx.inputs?.prices ?? {}, ctx.vatRate);
  const num = (n: number | null) => (n === null ? DOTS : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
  const rows =
    items.length > 0
      ? items.map((it, i) => [
          String(i + 1),
          it.description,
          it.unit || 'buc',
          it.quantity || BLANK,
          num(pricing.lines[i]?.unit ?? null),
          num(pricing.lines[i]?.value ?? null),
        ])
      : (spec?.deliverables ?? []).map((d, i) => [String(i + 1), d, BLANK, BLANK, DOTS, DOTS]);
  const vatPct = Number((ctx.vatRate * 100).toFixed(2));
  const sum = pricing.complete;

  const centralizer = [
    rows.length > 0
      ? table(
          ['Nr. crt.', 'Denumire lucrare / produs / serviciu', 'U.M.', 'Cantitate', 'Preț unitar (lei, fără TVA)', 'Valoare (lei, fără TVA)'],
          rows,
        )
      : `Articolele de preț nu au putut fi extrase automat; completați lista conform formularului centralizator din documentația de atribuire ${BLANK}.`,
    '',
    table(
      ['Sinteză', 'Valoare (lei)'],
      [
        ['**TOTAL fără TVA**', sum ? num(pricing.subtotal) : DOTS],
        [`TVA (${vatPct}%)`, sum ? num(pricing.vat) : DOTS],
        ['**TOTAL cu TVA**', sum ? num(pricing.total) : DOTS],
      ],
    ),
    '',
    tender.estimated_value !== null
      ? `Notă: valoarea estimată de autoritatea contractantă este de ${roMoney(tender.estimated_value, tender.currency === 'EUR' ? 'EUR' : 'lei')}, fără TVA. Prețul ofertat nu o poate depăși.`
      : 'Notă: autoritatea contractantă nu a publicat o valoare estimată.',
    sum
      ? 'Notă: prețurile au fost introduse de operatorul economic; verificați-le înainte de depunere.'
      : 'Notă: prețurile unitare și totalurile se introduc de operatorul economic.',
  ].join('\n');

  const letter = [
    `Către: **${tender.authority}**`,
    '',
    `Examinând documentația de atribuire, subsemnații, reprezentanți ai ofertantului **${company.name}** (CUI ${company.cui}), ne oferim ca, în conformitate cu prevederile și cerințele cuprinse în documentația de atribuire, să executăm / furnizăm „${tenderTitle(tender)}” pentru suma de ${sum ? num(pricing.subtotal) : DOTS} lei, fără TVA, la care se adaugă TVA în valoare de ${sum ? num(pricing.vat) : DOTS} lei (${vatPct}%).`,
    '',
    `Ne angajăm să respectăm termenul de execuție${spec?.duration ? ` de ${spec.duration}` : ` ${BLANK}`}, conform propunerii tehnice și graficului de execuție.`,
    '',
    `Ne angajăm să menținem această ofertă valabilă pentru o durată de ${ctx.inputs?.validityDays.trim() || DOTS} zile de la data limită de depunere a ofertelor (${roDate(tender.submission_deadline)}) și ea va rămâne obligatorie pentru noi, putând fi acceptată oricând înainte de expirarea perioadei de valabilitate.`,
    '',
    'Până la încheierea și semnarea contractului de achiziție publică, această ofertă, împreună cu comunicarea transmisă de dumneavoastră prin care oferta noastră este stabilită câștigătoare, vor constitui un contract angajant între noi.',
    '',
    'Am înțeles că nu sunteți obligați să acceptați oferta cu cel mai scăzut preț sau orice altă ofertă primită.',
  ].join('\n');

  const clauses = a.legal?.clauses ?? [];
  const conditions = [
    spec?.award_criteria ? `Criteriul de atribuire indicat de autoritate: ${spec.award_criteria}.` : null,
    spec?.duration ? `Durata contractului: ${spec.duration}.` : null,
    'Prețurile sunt exprimate în lei, fără TVA, și includ toate costurile necesare îndeplinirii contractului, conform propunerii tehnice.',
    'Condițiile de plată sunt cele din proiectul de contract din documentația de atribuire.',
  ].filter((x): x is string => x !== null);

  return [
    { agent: 'writer', title: '1. Formular de ofertă', body: letter },
    { agent: 'writer', title: '2. Formular centralizator de prețuri', body: centralizer },
    {
      agent: 'legal',
      title: '3. Condiții comerciale',
      body: [
        bullets(conditions),
        ...(clauses.length > 0
          ? [
              '',
              'Clauze contractuale care pot influența prețul (de verificat în proiectul de contract):',
              '',
              bullets(clauses.map((c) => `${c.clause}: ${c.concern}`)),
            ]
          : []),
      ].join('\n'),
    },
    { agent: 'writer', title: 'Semnătura', body: signature(company, ctx.inputs) },
  ];
}

function duae(tender: TenderWithState, company: CompanyProfile, ctx: DraftContext): DraftSection[] {
  const a = ctx.agents;
  const inp = ctx.inputs;
  const ex = inp?.exclusion ?? { A: null, B: null, C: null, D: null };
  const reqs = (a.spec?.items ?? []).filter((i) => i.category === 'qualification');
  const turnover =
    company.annual_turnover !== null
      ? roMoney(company.annual_turnover, company.annual_turnover_currency ?? 'lei')
      : BLANK;
  const experience =
    company.similar_experience_value !== null
      ? `${roMoney(company.similar_experience_value, company.similar_experience_currency ?? 'lei')}${
          company.similar_experience_contract_count ? `, în ${company.similar_experience_contract_count} contracte` : ''
        }`
      : BLANK;

  return [
    {
      agent: 'writer',
      title: 'Partea I: Informații privind procedura de achiziție și autoritatea contractantă',
      body: table(
        ['Câmp', 'Răspuns'],
        [
          ['Autoritatea contractantă', tender.authority],
          ['Titlul / obiectul achiziției', tenderTitle(tender)],
          ['Nr. de referință al procedurii (SEAP)', tender.external_id],
          ['Cod CPV', cpvLine(tender)],
          ['Termen limită de depunere', roDate(tender.submission_deadline)],
        ],
      ),
    },
    {
      agent: 'writer',
      title: 'Partea II: Informații privind operatorul economic',
      body: [
        '**A. Informații despre operatorul economic**',
        '',
        table(
          ['Câmp', 'Răspuns'],
          [
            ['Denumire', company.name],
            ['Număr de identificare fiscală (CUI)', company.cui],
            ['Adresa sediului social', inp?.address.trim() || BLANK],
            ['Persoană de contact, telefon, e-mail', BLANK],
            ['Adresa de internet', company.website ?? BLANK],
            ['Dimensiunea operatorului economic', inp?.size ? SIZE_RO[inp.size] : BLANK],
            ['Participă în grup cu alți operatori economici?', BLANK],
          ],
        ),
        '',
        '**B. Informații privind reprezentanții operatorului economic**',
        '',
        table(
          ['Nume și funcție', 'Date de contact', 'Calitatea de reprezentare'],
          [[inp?.repName.trim() ? `${inp.repName.trim()}${inp.repRole.trim() ? `, ${inp.repRole.trim()}` : ''}` : BLANK, BLANK, inp?.repName.trim() ? 'Reprezentant legal / mandatat' : BLANK]],
        ),
        '',
        '**C. Informații privind recurgerea la capacitățile altor entități**',
        '',
        `Operatorul economic recurge la capacitățile altor entități pentru îndeplinirea criteriilor de selecție: ${yesNo(inp?.otherEntities ?? null)}.`,
        '',
        '**D. Informații privind subcontractanții**',
        '',
        `Operatorul economic intenționează să subcontracteze o parte din contract: ${yesNo(inp?.subcontract ?? null)}.${inp?.subcontract === 'yes' ? ` ${inp.subcontractNote.trim() || 'Se completează denumirea și partea subcontractată.'}` : ''}`,
      ].join('\n'),
    },
    {
      agent: 'legal',
      title: 'Partea III: Motive de excludere',
      body: [
        table(
          ['Secțiunea', 'Motiv de excludere (Legea nr. 98/2016)', 'Răspuns'],
          [
            ['A', 'Motive legate de condamnări penale: participarea la o organizație criminală, corupție, fraudă, infracțiuni teroriste, spălare de bani, trafic de persoane (art. 164)', answer(ex.A)],
            ['B', 'Motive legate de plata impozitelor, taxelor și contribuțiilor de asigurări sociale (art. 165–166)', answer(ex.B)],
            ['C', 'Motive legate de insolvență, conflict de interese sau abateri profesionale (art. 167)', answer(ex.C)],
            ['D', 'Alte motive de excludere prevăzute de legislația națională', answer(ex.D)],
          ],
        ),
        '',
        inp?.confirmed
          ? 'Răspunsurile de mai sus au fost date de operatorul economic prin reprezentantul său; verificați-le înainte de semnare.'
          : 'Doar operatorul economic poate declara că motivele de excludere nu se aplică. Câmpurile marcate [de completat] rămân de completat de el.',
      ].join('\n'),
    },
    {
      agent: 'eligibility',
      title: 'Partea IV: Criterii de selecție',
      body: [
        '**A. Aptitudini de exercitare a activității profesionale**',
        '',
        `Operatorul economic este înregistrat la Oficiul Registrului Comerțului, cod unic de înregistrare ${company.cui}.`,
        '',
        '**B. Situația economică și financiară**',
        '',
        table(['Cerință', 'Răspuns'], [['Cifra de afaceri anuală (ultimul exercițiu financiar încheiat)', turnover]]),
        '',
        '**C. Capacități tehnice și profesionale**',
        '',
        table(
          ['Cerință', 'Răspuns'],
          [
            ['Valoarea cumulată a lucrărilor/serviciilor similare executate', experience],
            ...reqs.slice(0, 8).map((r) => [r.text, a.eligibility?.rows.find((x) => x.ref === r.ref)?.status === 'met' ? 'DA' : BLANK]),
          ],
        ),
        '',
        '**D. Scheme de asigurare a calității și standarde de gestiune a mediului**',
        '',
        bullets(company.certifications),
      ].join('\n'),
    },
    {
      agent: 'legal',
      title: 'Partea V: Reducerea numărului de candidați calificați',
      body: tender.procedure_type === 'restricted'
        ? `Procedura este restrânsă: operatorul economic completează informațiile solicitate de autoritate pentru selecția candidaților ${BLANK}.`
        : 'Nu se aplică, procedura nu limitează numărul de candidați.',
    },
    {
      agent: 'writer',
      title: 'Partea VI: Declarații finale',
      body: [
        'Subsemnatul, reprezentant autorizat al operatorului economic, declar pe propria răspundere că informațiile furnizate în părțile II–V sunt corecte și complete, și că sunt conștient de consecințele unei declarații false. Declar că pot prezenta, la cerere și fără întârziere, certificatele și celelalte forme de probe documentare menționate, cu excepția cazului în care autoritatea contractantă are posibilitatea de a le obține direct prin intermediul unei baze de date naționale.',
        '',
        'În completarea electronică din SEAP se folosește formularul DUAE al autorității; acest document este un proiect de pregătire a răspunsurilor.',
        '',
        signature(company, inp),
      ].join('\n'),
    },
  ];
}

/** The agents sometimes fall back to English for "unknown"; the submitted document must stay Romanian. */
function scrub(text: string): string {
  return text
    .replace(/\b(?:not stated|not specified|unknown|n\/a)(?:\s*\/\s*to confirm)?\b/gi, BLANK)
    .replace(/\bto be confirmed\b|\bto confirm\b/gi, BLANK)
    .replace(/(\[de completat\][\s,.;:]*){2,}/g, `${BLANK} `);
}

export function buildDraftSections(
  tender: TenderWithState,
  company: CompanyProfile,
  evidence: EvidenceDocument[],
  doc: DocType,
  ctx: DraftContext = { agents: {}, vatRate: 0.21 },
): DraftSection[] {
  const sections =
    doc === 'technical'
      ? technicalOffer(tender, company, evidence, ctx)
      : doc === 'financial'
        ? financialOffer(tender, company, ctx)
        : duae(tender, company, ctx);
  return sections.map((s) => ({ ...s, body: scrub(s.body) }));
}

/** Plain-text rendering of sections (copy fallback). */
export function joinSections(sections: DraftSection[]): string {
  return sections.map((s) => `## ${s.title}\n\n${s.body}`).join('\n\n');
}
