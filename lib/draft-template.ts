/**
 * Mock draft generator: deterministic template assembly from the tender file,
 * company profile and evidence archive. Section ordering and conventions
 * follow real Romanian submissions: the technical compliance table
 * (Nr. crt. | Cerință | Ofertă | Conformitate), the Formular de ofertă price
 * table with 19% VAT, and the ESPD/DUAE Parts I–VI structure with Law 98/2016
 * art. 164–167 exclusion grounds. UI language is English; field labels keep
 * their Romanian procurement names where bidders expect them.
 * The real backend will replace this with an LLM call — the component
 * contract (input → per-doc-type sections) stays the same.
 */
import type {
  CompanyProfile,
  DraftSection,
  EvidenceDocument,
  ProcedureType,
  TenderWithState,
} from './types';
import type { DocType } from '@/stores/useGeneratorStore';
import { formatDate, formatRON } from './format';

export const mockDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const DOC_TITLES: Record<DocType, string> = {
  technical: 'Technical offer',
  financial: 'Financial offer',
  duae: 'DUAE — European Single Procurement Document',
};

const PROCEDURE_LABEL: Record<ProcedureType, string> = {
  open: 'Open procedure',
  restricted: 'Restricted procedure',
  negotiated: 'Negotiated procedure',
  direct: 'Direct award',
  framework: 'Framework agreement',
};

/** Markdown front matter for copy-to-clipboard (PDF renders its own letterhead). */
export function draftFrontMatter(
  tender: TenderWithState,
  company: CompanyProfile,
  doc: DocType,
): string {
  return [
    `# ${DOC_TITLES[doc]}`,
    '',
    `**Operator economic:** ${company.name} (CUI ${company.cui})`,
    `**Autoritate contractantă:** ${tender.authority}`,
    `**Tender ref.:** ${tender.external_id} — ${tender.state.ai_title_simplified ?? tender.title}`,
    `**Date:** ${formatDate(new Date().toISOString())} | **Status:** DRAFT — review before submitting`,
    '',
  ].join('\n');
}

function bullets(items: string[]): string {
  return items.length > 0 ? items.map((r) => `- ${r}`).join('\n') : '- None.';
}

function identityTable(tender: TenderWithState, company: CompanyProfile): string {
  return [
    '| Field | Details |',
    '| ----- | ------- |',
    `| Operator economic | **${company.name}** |`,
    `| CUI (fiscal ID) | ${company.cui} |`,
    `| Tender reference | ${tender.external_id} |`,
    `| Autoritate contractantă | ${tender.authority} |`,
    `| Procedure | ${PROCEDURE_LABEL[tender.procedure_type]} |`,
    `| Submission deadline | ${formatDate(tender.submission_deadline)} |`,
  ].join('\n');
}

function technicalOffer(
  tender: TenderWithState,
  company: CompanyProfile,
  evidence: EvidenceDocument[],
): DraftSection[] {
  const matched = tender.state.matched_requirements;
  const unmet = [...tender.state.unmet_requirements, ...tender.state.missing_documents];
  const rows: string[] = [];
  let n = 0;
  for (const r of matched) {
    n += 1;
    rows.push(`| ${n} | ${r} | Fully compliant — delivered as specified in §3 | YES |`);
  }
  for (const r of unmet) {
    n += 1;
    rows.push(`| ${n} | ${r} | To be confirmed before submission — see §6 | NO* |`);
  }
  const complianceTable = [
    '| No. | Requirement (caiet de sarcini) | Our proposal | Compliant |',
    '| --- | ------------------------------ | ------------ | --------- |',
    ...(rows.length > 0 ? rows : ['| — | No separately scored criteria published | Compliant by default | YES |']),
  ].join('\n');

  return [
    { agent: 'writer', title: '1. Identification data', body: identityTable(tender, company) },
    {
      agent: 'spec',
      title: '2. Technical compliance table',
      body: [
        'Point-by-point compliance of our proposal against the tender specification:',
        '',
        complianceTable,
        '',
        unmet.length > 0
          ? '*Items marked NO must be resolved before submission.*'
          : '*All scored criteria are covered by this proposal.*',
      ].join('\n'),
    },
    {
      agent: 'writer',
      title: '3. Proposed solution and methodology',
      body: [
        tender.state.ai_summary ?? tender.raw_description ?? '',
        '',
        'Delivery methodology:',
        '',
        bullets([
          'Phased rollout with signed acceptance minutes per lot',
          'Romanian-language technical documentation and user manuals',
          'On-site support for the full warranty period',
        ]),
      ].join('\n'),
    },
    {
      agent: 'writer',
      title: '4. Implementation schedule',
      body: [
        '| Phase | Timing | Deliverable |',
        '| ----- | ------ | ----------- |',
        '| 1. Mobilisation | At contract start, per the authority timetable | Project plan, team assigned |',
        '| 2. Delivery in lots | Per the delivery terms in §2 | Goods/services per lot, reception minutes |',
        '| 3. Acceptance and warranty | Per the warranty terms in §2 | Final acceptance, warranty support |',
      ].join('\n'),
    },
    {
      agent: 'eligibility',
      title: '5. Personnel and capacity',
      body: [
        `The undersigned operator declares an annual capacity of ${formatRON(company.annual_capacity)} and assigns qualified key personnel for the full contract duration.`,
        '',
        'Relevant certifications:',
        '',
        bullets(company.certifications),
      ].join('\n'),
    },
    {
      agent: 'legal',
      title: '6. Declarations',
      body: bullets([
        `This offer is valid for 90 days from the submission deadline (${formatDate(tender.submission_deadline)}).`,
        'We comply with the applicable environmental, social and labour obligations (art. 51, Law 98/2016).',
        'No subcontracting is envisaged; any subcontractor will be declared to the authority before signing.',
        'All documents are submitted with qualified e-signature; originals are available on request.',
      ]),
    },
    {
      agent: 'writer',
      title: '7. Annex — supporting documents',
      body: bullets(evidence.map((e) => `${e.name} (${e.type})`)),
    },
  ];
}

function financialOffer(tender: TenderWithState, company: CompanyProfile): DraftSection[] {
  const total = tender.estimated_value;
  const priceTable =
    total === null
      ? [
          'Contract value: **not published** by the authority.',
          '',
          'We bid a lump-sum price; unit prices follow the technical specification in §2 of our technical offer.',
        ].join('\n')
      : (() => {
          const delivery = Math.round(total * 0.7);
          const warranty = Math.round(total * 0.2);
          const contingency = total - delivery - warranty;
          const vat = Math.round(total * 0.19);
          return [
            'Indicative lot allocation proposed by the bidder, as shares of the published contract value:',
            '',
            '| Description | Amount (RON, excl. VAT) |',
            '| ----------- | ----------------------- |',
            `| Lot 1 — Delivery / execution | ${formatRON(delivery)} |`,
            `| Lot 2 — Warranty & support | ${formatRON(warranty)} |`,
            `| Contingency | ${formatRON(contingency)} |`,
            `| **Subtotal, excl. VAT** | **${formatRON(total)}** |`,
            `| VAT (19%) | ${formatRON(vat)} |`,
            `| **TOTAL, incl. VAT** | **${formatRON(total + vat)}** |`,
          ].join('\n');
        })();
  return [
    { agent: 'writer', title: '1. Identification data', body: identityTable(tender, company) },
    {
      agent: 'writer',
      title: '2. Bid price (tender form)',
      body: [
        priceTable,
        '',
        `Bidder: **${company.name}** (CUI ${company.cui}). All prices are firm in RON for the full validity period.`,
      ].join('\n'),
    },
    {
      agent: 'writer',
      title: '3. Payment schedule',
      body: [
        'Proposed payment terms:',
        '',
        '1. 30% advance within 15 days of signing',
        '2. 60% on acceptance of delivery milestones, against reception minutes',
        '3. 10% on final acceptance',
      ].join('\n'),
    },
    {
      agent: 'legal',
      title: '4. Price validity and terms',
      body: bullets([
        `This financial offer is valid for 90 days from the submission deadline (${formatDate(tender.submission_deadline)}).`,
        'Prices are fixed and include all delivery, installation and warranty costs.',
        'Currency: RON. Payments by bank transfer within 30 days of invoice.',
      ]),
    },
  ];
}

function duae(tender: TenderWithState, company: CompanyProfile): DraftSection[] {
  return [
    {
      agent: 'writer',
      title: 'Part I–II — Procedure and economic operator',
      body: [
        'Part I is completed by the contracting authority in SEAP. The undersigned operator declares:',
        '',
        identityTable(tender, company),
      ].join('\n'),
    },
    {
      agent: 'legal',
      title: 'Part III — Exclusion grounds (Law 98/2016, art. 164–167)',
      body: bullets([
        'A. Criminal convictions (art. 164): NO — neither the operator nor its representatives have final convictions for fraud, corruption, money laundering or related offences.',
        'B. Taxes and social contributions (art. 165): all obligations fulfilled; certificates available on request.',
        'C. Insolvency, conflicts of interest, professional misconduct (art. 167): NO — none of the situations apply.',
        'D. Purely national exclusion grounds: NO — none apply.',
      ]),
    },
    {
      agent: 'eligibility',
      title: 'Part IV — Selection criteria',
      body: [
        `A. Professional suitability: identified by CUI ${company.cui}; declared activity covers CPV ${tender.cpv_codes.join(', ')}.`,
        `B. Economic and financial standing: annual capacity of ${formatRON(company.annual_capacity)}.`,
        '',
        'C. Technical and professional ability — the following criteria are self-declared as met:',
        '',
        bullets(tender.state.matched_requirements),
        '',
        `D. Quality assurance: ${company.certifications.join(', ') || '—'}.`,
      ].join('\n'),
    },
    {
      agent: 'writer',
      title: 'Part VI — Final statements',
      body: [
        'The undersigned declares that the information above is accurate, that supporting evidence can be provided without delay upon request, and that the authority may verify any statement with the issuing bodies.',
        '',
        'Semnătura / Signature: ..............................   Data / Date: ............   Ștampila / Stamp',
      ].join('\n'),
    },
  ];
}

export function buildDraftSections(
  tender: TenderWithState,
  company: CompanyProfile,
  evidence: EvidenceDocument[],
  doc: DocType,
): DraftSection[] {
  switch (doc) {
    case 'technical':
      return technicalOffer(tender, company, evidence);
    case 'financial':
      return financialOffer(tender, company);
    case 'duae':
      return duae(tender, company);
  }
}

/** Plain-text rendering of sections (copy fallback). */
export function joinSections(sections: DraftSection[]): string {
  return sections.map((s) => `## ${s.title}\n\n${s.body}`).join('\n\n');
}
