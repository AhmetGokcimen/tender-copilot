/** Mock dataset shaped exactly like the backend JSON (see lib/types.ts).
 * Tender titles stay in Romanian (as SEAP publishes them); the AI layer
 * provides `ai_title_simplified` + `ai_summary` in the UI language.
 */
import type {
  AuthMe,
  CompanyOptions,
  CompanyProfile,
  CountryAuthorization,
  CountryRequirements,
  EvidenceDocument,
  TenderWithState,
} from './types';

const S = 'romania_seap' as const;

export const MOCK_TENDERS: TenderWithState[] = [
  {
    source_system: S,
    external_id: 'CN1064821',
    country_code: 'RO',
    title: 'Furnizare echipamente IT și licențe software pentru unități de învățământ',
    cpv_codes: ['30200000', '48000000'],
    estimated_value: 4200000,
    currency: 'RON',
    publication_date: '2026-10-18',
    submission_deadline: '2026-11-20',
    raw_description:
      'Achiziția de laptopuri, tablete interactive și licențe software educațional pentru 42 de unități de învățământ preuniversitar.',
    source_url: 'https://e-licitatie.ro/CN1064821',
    authority: 'Ministerul Educației',
    county: 'București',
    procedure_type: 'open',
    clarification_deadline: '2026-11-10',
    state: {
      score: 92,
      score_reasons: [
        'Both CPV codes match your company profile',
        'Value RON 4.2M is within your annual capacity',
        'No blacklist keywords in the tender file',
      ],
      ai_summary:
        'Supply of laptops, interactive tablets and educational software licenses for 42 pre-university schools. Delivery in 3 lots over 60 days; 24-month warranty required.',
      ai_title_simplified: 'IT equipment and software licenses for schools',
      extracted_requirements: [
        'Minimum 3 similar contracts in the last 3 years',
        'ISO 9001:2015 certified quality management',
        '24-month warranty and on-site support in Bucharest',
        'Delivery in 3 lots within 60 days of signing',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'Minimum 3 similar contracts in the last 3 years',
        'ISO 9001:2015 certified quality management',
        '24-month warranty and on-site support in Bucharest',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'All qualification criteria are covered by your profile: matching CPV history, valid ISO 9001 certificate and sufficient delivery capacity.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065104',
    country_code: 'RO',
    title: 'Servicii de mentenanță și suport tehnic pentru infrastructura informatică',
    cpv_codes: ['50300000', '72200000'],
    estimated_value: 860000,
    currency: 'RON',
    publication_date: '2026-10-10',
    submission_deadline: '2026-10-30',
    raw_description:
      'Servicii de mentenanță preventivă și corectivă, helpdesk și suport tehnic pentru infrastructura IT a primăriei, pe o perioadă de 24 de luni.',
    source_url: 'https://e-licitatie.ro/CN1065104',
    authority: 'Primăria Cluj-Napoca',
    county: 'Cluj',
    procedure_type: 'open',
    clarification_deadline: '2026-10-24',
    state: {
      score: 88,
      score_reasons: [
        'CPV 50300000 matches your maintenance service history',
        'Local delivery (Cluj) — your registered county',
        'Deadline in 4 days: bid or drop quickly',
      ],
      ai_summary:
        '2-year preventive/corrective maintenance, helpdesk and on-site IT support for the city hall. Requires 4h response SLA and a local Cluj support point.',
      ai_title_simplified: 'IT maintenance and helpdesk for Cluj-Napoca city hall',
      extracted_requirements: [
        '4-hour response SLA, 8x5 helpdesk in Romanian',
        'Local support point in Cluj county',
        'At least 2 certified network engineers on staff',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        '4-hour response SLA, 8x5 helpdesk in Romanian',
        'Local support point in Cluj county',
        'At least 2 certified network engineers on staff',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'Fully covered: you operate a Cluj support point and hold the required engineering certifications.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064990',
    country_code: 'RO',
    title: 'Lucrări de reabilitare termică a blocurilor de locuințe — lot 2',
    cpv_codes: ['45000000'],
    estimated_value: 12500000,
    currency: 'RON',
    publication_date: '2026-10-15',
    submission_deadline: '2026-12-05',
    raw_description:
      'Lucrări de construcții pentru reabilitarea termică a 18 blocuri de locuințe, inclusiv anvelopare și înlocuire tâmplărie.',
    source_url: 'https://e-licitatie.ro/CN1064990',
    authority: 'Primăria Timișoara',
    county: 'Timiș',
    procedure_type: 'open',
    clarification_deadline: '2026-11-22',
    state: {
      score: 41,
      score_reasons: [
        'CPV 45000000 (construction) is outside your profile',
        'Contains blacklist keyword "lucrări"',
        'Requires construction authorizations you do not hold',
      ],
      ai_summary:
        'Thermal rehabilitation (insulation, windows) of 18 residential blocks. Lots require certified construction crews and ANRE authorizations.',
      ai_title_simplified: 'Thermal rehabilitation works for residential blocks',
      extracted_requirements: [
        'ANRE-authorized construction crews',
        'Minimum 5 similar thermal rehabilitation contracts',
        'Turnover ≥ RON 25M in construction works',
      ],
      eligible: false,
      country_authorization_status: null,
      matched_requirements: [],
      unmet_requirements: [
        'ANRE-authorized construction crews',
        'Minimum 5 similar thermal rehabilitation contracts',
        'Turnover ≥ RON 25M in construction works',
      ],
      eligibility_justification:
        'Not eligible: construction works are outside your CAEN/CPV scope and you hold none of the required authorizations.',
      missing_documents: ['ANRE construction authorization', 'Proof of RON 25M construction turnover'],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065233',
    country_code: 'RO',
    title: 'Furnizare echipamente medicale și dispozitive de laborator',
    cpv_codes: ['33000000'],
    estimated_value: null, // not published by the authority (real SEAP case)
    currency: 'RON',
    publication_date: '2026-10-20',
    submission_deadline: '2026-11-02',
    raw_description:
      'Echipamente de imagistică și dispozitive de laborator pentru secția de analize medicale, cu instalare și instruire personal.',
    source_url: 'https://e-licitatie.ro/CN1065233',
    authority: 'Spitalul Județean Brașov',
    county: 'Brașov',
    procedure_type: 'restricted',
    clarification_deadline: '2026-10-27',
    state: {
      score: 55,
      score_reasons: [
        'CPV 33000000 partially overlaps your supply history',
        'Medical-device certification (ISO 13485) not confirmed',
        'Restricted procedure: shortlisting risk',
      ],
      ai_summary:
        'Imaging equipment and lab devices with installation and staff training. Bidders need medical-device distribution authorization from ANMDM.',
      ai_title_simplified: 'Medical and laboratory equipment supply',
      extracted_requirements: [
        'ANMDM medical-device distribution authorization',
        'ISO 13485 quality management (or equivalent)',
        'Installation + staff training included',
      ],
      eligible: null,
      country_authorization_status: null,
      matched_requirements: ['Installation + staff training included'],
      unmet_requirements: [
        'ANMDM medical-device distribution authorization',
        'ISO 13485 quality management (or equivalent)',
      ],
      eligibility_justification:
        'Uncertain: eligibility hinges on the ANMDM authorization and ISO 13485, which are not in your profile. Verify before bidding.',
      missing_documents: ['ANMDM distribution authorization', 'ISO 13485 certificate'],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064877',
    country_code: 'RO',
    title: 'Servicii de consultanță în management și elaborare strategii digitale',
    cpv_codes: ['79400000', '72200000'],
    estimated_value: 1400000,
    currency: 'RON',
    publication_date: '2026-10-12',
    submission_deadline: '2026-11-28',
    raw_description:
      'Consultanță pentru elaborarea strategiei de digitalizare 2027–2030, inclusiv auditul proceselor și roadmap de implementare.',
    source_url: 'https://e-licitatie.ro/CN1064877',
    authority: 'Agenția pentru Agenda Digitală',
    county: 'București',
    procedure_type: 'open',
    clarification_deadline: '2026-11-15',
    state: {
      score: 84,
      score_reasons: [
        'Both CPV codes match your consulting history',
        'No special authorizations required',
        'Comfortable 33-day bidding window',
      ],
      ai_summary:
        'Digitalization strategy 2027–2030: process audit, target architecture and implementation roadmap. Deliverable-based, 6 months.',
      ai_title_simplified: 'Digital strategy consulting services',
      extracted_requirements: [
        'At least 2 digitalization strategies delivered for public bodies',
        'Team: 1 PMP project manager + 2 senior consultants',
        'Romanian-language deliverables, on-site workshops in Bucharest',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'At least 2 digitalization strategies delivered for public bodies',
        'Team: 1 PMP project manager + 2 senior consultants',
        'Romanian-language deliverables, on-site workshops in Bucharest',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'All criteria matched against your consulting references and certified team.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065310',
    country_code: 'RO',
    title: 'Furnizare mobilier școlar pentru unități de învățământ preuniversitar',
    cpv_codes: ['39100000'],
    estimated_value: 3300000,
    currency: 'RON',
    publication_date: '2026-10-22',
    submission_deadline: '2026-11-15',
    raw_description:
      'Bănci, scaune și mobilier modular pentru 60 de săli de clasă, cu montaj și garanție 36 de luni.',
    source_url: 'https://e-licitatie.ro/CN1065310',
    authority: 'Consiliul Județean Iași',
    county: 'Iași',
    procedure_type: 'open',
    clarification_deadline: '2026-11-05',
    state: {
      score: 38,
      score_reasons: [
        'CPV 39100000 (furniture) is outside your profile',
        'Requires furniture manufacturing references',
        'No overlap with your delivery history',
      ],
      ai_summary:
        'School furniture (desks, chairs, modular units) for 60 classrooms, with assembly and 36-month warranty.',
      ai_title_simplified: 'School furniture supply and assembly',
      extracted_requirements: [
        'Furniture manufacturing or authorized distribution references',
        '36-month warranty with on-site repair',
        'Assembly in 60 classrooms across Iași county',
      ],
      eligible: false,
      country_authorization_status: null,
      matched_requirements: [],
      unmet_requirements: [
        'Furniture manufacturing or authorized distribution references',
        '36-month warranty with on-site repair',
        'Assembly in 60 classrooms across Iași county',
      ],
      eligibility_justification:
        'Not eligible: furniture supply is outside your CPV scope and reference history.',
      missing_documents: ['Furniture distribution references'],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064762',
    country_code: 'RO',
    title: 'Servicii de dezvoltare platformă software pentru managementul documentelor',
    cpv_codes: ['72200000'],
    estimated_value: 6800000,
    currency: 'RON',
    publication_date: '2026-10-05',
    submission_deadline: '2026-11-10',
    raw_description:
      'Dezvoltarea unei platforme de management electronic al documentelor, cu fluxuri de aprobare, semnătură electronică și arhivare conform legislației.',
    source_url: 'https://e-licitatie.ro/CN1064762',
    authority: 'Ministerul Finanțelor (ANAF)',
    county: 'București',
    procedure_type: 'restricted',
    clarification_deadline: '2026-10-28',
    state: {
      score: 91,
      score_reasons: [
        'CPV 72200000 is your core business line',
        'Value RON 6.8M is within your annual capacity',
        'Your ISO 27001 covers the security requirements',
      ],
      ai_summary:
        'Document-management platform with approval workflows, qualified e-signature and compliant archiving. Agile delivery, 12 months, on-premise.',
      ai_title_simplified: 'Document-management platform development',
      extracted_requirements: [
        'ISO/IEC 27001:2022 information security certification',
        'At least 1 e-signature integration delivered for a public body',
        'On-premise deployment with source-code escrow',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'ISO/IEC 27001:2022 information security certification',
        'At least 1 e-signature integration delivered for a public body',
        'On-premise deployment with source-code escrow',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'Strong match: core CPV, security certification on file and a directly relevant ANAF-adjacent reference.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065448',
    country_code: 'RO',
    title: 'Servicii de catering pentru spitale și cantine sociale',
    cpv_codes: ['55500000'],
    estimated_value: 950000,
    currency: 'RON',
    publication_date: '2026-10-24',
    submission_deadline: '2026-10-31',
    raw_description:
      'Prepararea și livrarea zilnică a meselor pentru spitale și cantine sociale, conform normelor sanitar-veterinare.',
    source_url: 'https://e-licitatie.ro/CN1065448',
    authority: 'DGASPC Sector 3',
    county: 'București',
    procedure_type: 'open',
    clarification_deadline: null, // direct awards often skip this (real SEAP case)
    state: {
      score: 22,
      score_reasons: [
        'Contains blacklist keyword "catering"',
        'CPV 55500000 is outside your profile',
        'Requires sanitary-veterinary authorizations',
      ],
      ai_summary:
        'Daily meal preparation and delivery for hospitals and social canteens under sanitary-veterinary norms.',
      ai_title_simplified: 'Catering services for hospitals and canteens',
      extracted_requirements: [
        'Sanitary-veterinary operating authorization',
        'HACCP-certified production facility',
        'Daily delivery fleet with temperature control',
      ],
      eligible: false,
      country_authorization_status: null,
      matched_requirements: [],
      unmet_requirements: [
        'Sanitary-veterinary operating authorization',
        'HACCP-certified production facility',
        'Daily delivery fleet with temperature control',
      ],
      eligibility_justification:
        'Excluded by your blacklist ("catering") and entirely outside your business scope.',
      missing_documents: ['Sanitary-veterinary authorization', 'HACCP certificate'],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064559',
    country_code: 'RO',
    title: 'Acord-cadru de furnizare consumabile IT și periferice — 24 luni',
    cpv_codes: ['30200000'],
    estimated_value: 1900000,
    currency: 'RON',
    publication_date: '2026-09-28',
    submission_deadline: '2026-12-18',
    raw_description:
      'Acord-cadru pentru furnizarea de consumabile IT, periferice și accesorii pe o perioadă de 24 de luni, cu comenzi subsecvente.',
    source_url: 'https://e-licitatie.ro/CN1064559',
    authority: 'Universitatea Babeș-Bolyai',
    county: 'Cluj',
    procedure_type: 'framework',
    clarification_deadline: '2026-12-01',
    state: {
      score: 79,
      score_reasons: [
        'CPV 30200000 matches your supply history',
        'Repeat buyer: you delivered a 2024 contract for UBB',
        'Framework agreement: steady 24-month revenue',
      ],
      ai_summary:
        '24-month framework agreement for IT consumables and peripherals with subsequent mini-orders. Award favors incumbent suppliers with UBB references.',
      ai_title_simplified: 'IT consumables framework agreement (24 months)',
      extracted_requirements: [
        'Distributor authorization from at least 2 hardware vendors',
        '48h delivery SLA to Cluj-Napoca',
        'Online ordering portal for subsequent contracts',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'Distributor authorization from at least 2 hardware vendors',
        '48h delivery SLA to Cluj-Napoca',
      ],
      unmet_requirements: ['Online ordering portal for subsequent contracts'],
      eligibility_justification:
        'Eligible with one gap: the ordering portal. Your 2024 UBB reference strongly favors this bid.',
      missing_documents: ['Vendor distributor authorizations (2)'],
      status: 'new',
    },
  },
];

export const MOCK_COMPANY: CompanyProfile = {
  id: 1,
  name: 'SC Transilvania Soft SRL',
  cui: 'RO18402933',
  industry: 'software',
  founded_year: 2012,
  team_size: 45,
  cpv_codes: ['30200000', '48000000', '50300000', '72200000', '79400000'],
  secondary_cpv_codes: [],
  annual_capacity: 15000000,
  certifications: ['ISO 9001:2015', 'ISO/IEC 27001:2022', 'ANAF fiscal compliance'],
  blacklist_keywords: ['catering', 'construcții', 'lucrări'],
  annual_turnover: 15000000,
  annual_turnover_currency: 'RON',
  similar_experience_value: 22000000,
  similar_experience_currency: 'RON',
  similar_experience_contract_count: 6,
  target_countries: ['RO'],
  keywords: ['software-licenses', 'maintenance'],
  website: null,
  subsectors: [],
  annual_capacity_currency: 'RON',
  team_eu_count: null,
  team_non_eu_count: null,
};

export const MOCK_EVIDENCE: EvidenceDocument[] = [
  { id: 'ev1', name: 'ANAF Fiscal Compliance Certificate', type: 'Fiscal', valid_until: '2027-03-31' },
  { id: 'ev2', name: 'ISO 9001:2015 Certificate', type: 'Quality', valid_until: '2027-11-20' },
  { id: 'ev3', name: 'ISO/IEC 27001:2022 Certificate', type: 'Security', valid_until: '2026-12-15' },
  { id: 'ev4', name: 'ONRC Company Certificate (certificat constatator)', type: 'Legal', valid_until: '2026-11-30' },
  { id: 'ev5', name: 'Reference contract — UBB IT consumables 2024', type: 'Reference', valid_until: null },
  { id: 'ev6', name: 'Fiscal record (cazier fiscal) — 2025', type: 'Fiscal', valid_until: '2026-10-01' },
];

export const MOCK_QUOTA = { used: 8, total: 15 };

/**
 * Mock copy of GET /company/options (backend/core/lookups.py). Real mode
 * always fetches this from the backend — never import this outside mock
 * branches. Keep in sync with the backend when it grows.
 */
export const MOCK_OPTIONS: CompanyOptions = {
  industries: [
    { key: 'construction', label: 'Construction & civil works', suggested_cpv_codes: ['45000000'] },
    { key: 'it-hardware', label: 'IT hardware & equipment', suggested_cpv_codes: ['30200000'] },
    { key: 'software', label: 'Software & IT services', suggested_cpv_codes: ['48000000', '72200000'] },
    { key: 'consulting', label: 'Consulting & business services', suggested_cpv_codes: ['79400000'] },
    { key: 'medical', label: 'Medical devices & pharma', suggested_cpv_codes: ['33000000'] },
    { key: 'furniture', label: 'Furniture & office supplies', suggested_cpv_codes: ['39100000'] },
    { key: 'catering', label: 'Catering & food services', suggested_cpv_codes: ['55500000'] },
    { key: 'transport', label: 'Transport & logistics', suggested_cpv_codes: ['60000000'] },
    { key: 'energy', label: 'Energy & fuels', suggested_cpv_codes: ['09000000'] },
    { key: 'security', label: 'Security & surveillance', suggested_cpv_codes: ['79700000'] },
  ],
  keywords: [
    { key: 'road-works', label: 'Road works', related_cpv_codes: ['45233120'] },
    { key: 'it-equipment', label: 'IT equipment supply', related_cpv_codes: ['30200000'] },
    { key: 'software-licenses', label: 'Software licenses', related_cpv_codes: ['48000000'] },
    { key: 'maintenance', label: 'Maintenance & helpdesk', related_cpv_codes: ['50300000'] },
    { key: 'consulting', label: 'Consulting services', related_cpv_codes: ['79400000'] },
    { key: 'medical-devices', label: 'Medical devices', related_cpv_codes: ['33000000'] },
    { key: 'furniture', label: 'Furniture supply', related_cpv_codes: ['39100000'] },
    { key: 'catering', label: 'Catering services', related_cpv_codes: ['55500000'] },
    { key: 'transport', label: 'Transport services', related_cpv_codes: ['60000000'] },
    { key: 'energy', label: 'Energy supply', related_cpv_codes: ['09000000'] },
  ],
  countries: [{ code: 'RO', name: 'Romania', source_systems: ['romania_seap'] }],
};

/**
 * Mock seed: mirrors the backend auto-seed (target RO picked → not_started
 * row). The mock auth store persists user edits on top of this.
 */
export const MOCK_AUTHORIZATIONS: CountryAuthorization[] = [
  {
    country_code: 'RO',
    status: 'not_started',
    requirement_notes: null,
    updated_at: '2026-10-27T10:00:00Z',
  },
];

/**
 * Mock copy of GET /countries/{code}/requirements. Real mode always
 * fetches from the backend — never import outside mock branches.
 */
const MOCK_REQUIREMENT_GUIDES: Record<string, CountryRequirements> = {
  RO: {
    country_code: 'RO',
    name: 'Romania',
    guide_available: true,
    guidance:
      'Companies bidding in Romania typically need to be registered with the Trade Registry (ONRC) or act through a locally registered branch, subsidiary, or authorized representative; some procedures additionally require ANAF fiscal registration. Exact requirements vary by procedure — confirm with the contracting authority or a local advisor. General information only, not legal advice.',
  },
};

export function mockRequirementsFor(code: string): CountryRequirements {
  return (
    MOCK_REQUIREMENT_GUIDES[code] ?? {
      country_code: code,
      name: null,
      guide_available: false,
      guidance: `Country-specific guidance for ${code} is coming soon. Confirm requirements with the contracting authority or a local advisor. General information only, not legal advice.`,
    }
  );
}

export const MOCK_ME: AuthMe = {
  sub: 'demo',
  email: 'demo@ofera.local',
  name: 'Demo User',
  provider: 'demo',
  company_ids: [1],
};
