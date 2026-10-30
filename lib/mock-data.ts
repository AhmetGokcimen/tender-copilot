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
    title: 'Reabilitare și modernizare a 6 școli gimnaziale',
    cpv_codes: ['45214200',  '45262700'],
    estimated_value: 4200000,
    currency: 'RON',
    publication_date: '2026-10-18',
    submission_deadline: '2026-11-20',
    raw_description:
      'Lucrări de reabilitare, consolidare și modernizare energetică pentru 6 școli gimnaziale, inclusiv acoperiș, fațadă și instalații.',
    source_url: 'https://e-licitatie.ro/CN1064821',
    authority: 'Ministerul Educației',
    county: 'București',
    procedure_type: 'open',
    clarification_deadline: '2026-11-10',
    state: {
      score: 92,
      score_reasons: [
        'CPV 45214200 matches your school-building references',
        'Value RON 4.2M is within your annual capacity',
        'Your Class III building authorization covers this value',
      ],
      ai_summary:
        'Structural repairs, new roofs, facade insulation and electrical works for 6 middle schools. Works run in phases over the summer breaks, 36 months total.',
      ai_title_simplified: 'Renovation and modernization of 6 schools',
      extracted_requirements: [
        'Minimum 3 similar school or public-building contracts in the last 5 years',
        'ISO 9001:2015 and ISO 45001 certified',
        'Site manager with ISC authorization (diriginte de șantier)',
        'Works phased around the school year',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'Minimum 3 similar school or public-building contracts in the last 5 years',
        'ISO 9001:2015 and ISO 45001 certified',
        'Site manager with ISC authorization (diriginte de șantier)',
        'Works phased around the school year',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'All qualification criteria are covered by your profile: matching CPV history, valid ISO certificates and sufficient execution capacity.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065104',
    country_code: 'RO',
    title: 'Reparații străzi și trotuare, cartiere Mănăștur și Gheorgheni',
    cpv_codes: ['45233120',  '45233222'],
    estimated_value: 860000,
    currency: 'RON',
    publication_date: '2026-10-10',
    submission_deadline: '2026-10-30',
    raw_description:
      'Lucrări de reparații la carosabil, trotuare și parcări, inclusiv frezare, reprofilare și covor asfaltic, pe o perioadă de 12 luni.',
    source_url: 'https://e-licitatie.ro/CN1065104',
    authority: 'Primăria Cluj-Napoca',
    county: 'Cluj',
    procedure_type: 'open',
    clarification_deadline: '2026-10-24',
    state: {
      score: 88,
      score_reasons: [
        'CPV 45233120 matches your road-works history',
        'Local execution (Cluj) is in your registered county',
        'Deadline in 4 days: bid or drop quickly',
      ],
      ai_summary:
        'Milling, resurfacing and sidewalk repairs across two districts of Cluj-Napoca. 12-month execution, asphalt plant within 60 km required.',
      ai_title_simplified: 'Street and sidewalk repairs in Cluj-Napoca',
      extracted_requirements: [
        'Minimum 2 road contracts of RON 500K or more in the last 5 years',
        'Asphalt plant or supply contract within 60 km',
        'Road-works authorization (ISC class)',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'Minimum 2 road contracts of RON 500K or more in the last 5 years',
        'Asphalt plant or supply contract within 60 km',
        'Road-works authorization (ISC class)',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'Fully covered: you hold the road-works authorization and an asphalt supply contract near Cluj.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064990',
    country_code: 'RO',
    title: 'Lucrări de reabilitare termică a blocurilor de locuințe — lot 2',
    cpv_codes: ['45321000',  '45421100'],
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
        'Requires turnover of RON 25M, above your 3-year average',
        'Needs 5 similar rehabilitation contracts; you have 3',
        'Value RON 12.5M is close to your annual capacity',
      ],
      ai_summary:
        'Thermal rehabilitation (insulation, windows) of 18 residential blocks. The tender asks for larger turnover and more similar contracts than your profile shows.',
      ai_title_simplified: 'Thermal rehabilitation works for residential blocks',
      extracted_requirements: [
        'Minimum 5 similar thermal rehabilitation contracts',
        'Turnover ≥ RON 25M in construction works',
        'Crews with ANRE energy-efficiency authorization',
      ],
      eligible: false,
      country_authorization_status: null,
      matched_requirements: [],
      unmet_requirements: [
        'Minimum 5 similar thermal rehabilitation contracts',
        'Turnover ≥ RON 25M in construction works',
      ],
      eligibility_justification:
        'Not eligible as it stands: you have 3 of the 5 required similar contracts and turnover below RON 25M. A consortium with a larger partner could close the gap.',
      missing_documents: [
        'Proof of RON 25M construction turnover',
        'Two more thermal rehabilitation reference contracts',
      ],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065233',
    country_code: 'RO',
    title: 'Extindere rețea de canalizare și modernizare stație de epurare',
    cpv_codes: ['45232410',  '45252127'],
    estimated_value: null, // not published by the authority (real SEAP case)
    currency: 'RON',
    publication_date: '2026-10-20',
    submission_deadline: '2026-11-02',
    raw_description:
      'Lucrări de extindere a rețelei de canalizare menajeră și modernizare a stației de epurare, inclusiv bazine, pompe și automatizare.',
    source_url: 'https://e-licitatie.ro/CN1065233',
    authority: 'Compania de Apă Brașov',
    county: 'Brașov',
    procedure_type: 'restricted',
    clarification_deadline: '2026-10-27',
    state: {
      score: 55,
      score_reasons: [
        'CPV 45232410 partially overlaps your utility-works history',
        'Treatment-plant references not confirmed',
        'Restricted procedure: shortlisting risk',
      ],
      ai_summary:
        'New sewer lines and an upgrade of the wastewater treatment plant, including tanks, pumps and automation. Bidders need hydro-technical references.',
      ai_title_simplified: 'Sewer network extension and treatment plant upgrade',
      extracted_requirements: [
        'Minimum 1 wastewater treatment plant reference',
        'ISO 14001 environmental management (or equivalent)',
        'Hydro-technical works authorization',
      ],
      eligible: null,
      country_authorization_status: null,
      matched_requirements: [
        'Hydro-technical works authorization',
      ],
      unmet_requirements: [
        'Minimum 1 wastewater treatment plant reference',
        'ISO 14001 environmental management (or equivalent)',
      ],
      eligibility_justification:
        'Uncertain: eligibility hinges on a treatment-plant reference and ISO 14001, which are not in your profile. Verify before bidding.',
      missing_documents: [
        'Treatment-plant reference contract',
        'ISO 14001 certificate',
      ],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064877',
    country_code: 'RO',
    title: 'Consolidare și reparații la podul peste râul Bistrița',
    cpv_codes: ['45221111',  '45221120'],
    estimated_value: 1400000,
    currency: 'RON',
    publication_date: '2026-10-12',
    submission_deadline: '2026-11-28',
    raw_description:
      'Lucrări de consolidare a infrastructurii, înlocuire a hidroizolației și reparații la parapeți și pe carosabil pentru un pod rutier.',
    source_url: 'https://e-licitatie.ro/CN1064877',
    authority: 'Consiliul Județean Neamț',
    county: 'Neamț',
    procedure_type: 'open',
    clarification_deadline: '2026-11-15',
    state: {
      score: 84,
      score_reasons: [
        'Both CPV codes match your bridge and civil-works history',
        'Value RON 1.4M is within your annual capacity',
        'Bridge-works authorization on file',
      ],
      ai_summary:
        'Strengthening of abutments and piers, new waterproofing and road surface on a county bridge. Traffic must stay open on one lane.',
      ai_title_simplified: 'Bridge strengthening and repairs over the Bistrița river',
      extracted_requirements: [
        'Minimum 1 bridge repair contract in the last 5 years',
        'Traffic management plan for one-lane operation',
        'Bridge-works authorization (ISC)',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'Minimum 1 bridge repair contract in the last 5 years',
        'Traffic management plan for one-lane operation',
        'Bridge-works authorization (ISC)',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'All criteria are covered: you hold the bridge-works authorization and a comparable reference.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065310',
    country_code: 'RO',
    title: 'Construire creșă și grădiniță cu 8 grupe',
    cpv_codes: ['45214100',  '45214200'],
    estimated_value: 3300000,
    currency: 'RON',
    publication_date: '2026-10-22',
    submission_deadline: '2026-11-15',
    raw_description:
      'Lucrări de construire a unei creșe și grădinițe cu 8 grupe, inclusiv fundații, structură, instalații și amenajări exterioare.',
    source_url: 'https://e-licitatie.ro/CN1065310',
    authority: 'Consiliul Județean Iași',
    county: 'Iași',
    procedure_type: 'open',
    clarification_deadline: '2026-11-05',
    state: {
      score: 38,
      score_reasons: [
        'CPV 45214100 is outside your usual project types',
        'Value RON 3.3M is within your annual capacity',
        'No new-build education reference found',
      ],
      ai_summary:
        'Ground-up construction of a nursery and kindergarten with 8 groups, including structure, MEP installations and landscaping. 18-month schedule.',
      ai_title_simplified: 'New nursery and kindergarten building (8 groups)',
      extracted_requirements: [
        'Minimum 2 new-build education or healthcare buildings',
        'Class IV building authorization',
        'Site manager with ISC authorization (diriginte de șantier)',
      ],
      eligible: false,
      country_authorization_status: null,
      matched_requirements: [
        'Class IV building authorization',
        'Site manager with ISC authorization (diriginte de șantier)',
      ],
      unmet_requirements: [
        'Minimum 2 new-build education or healthcare buildings',
      ],
      eligibility_justification:
        'Weak match: you cover the authorization but have no new-build education references.',
      missing_documents: [
        'Two new-build education reference contracts',
      ],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064762',
    country_code: 'RO',
    title: 'Execuție drum de acces și rețele de utilități pentru parc industrial',
    cpv_codes: ['45233100',  '45231300'],
    estimated_value: 6800000,
    currency: 'RON',
    publication_date: '2026-10-05',
    submission_deadline: '2026-11-10',
    raw_description:
      'Lucrări de execuție a unui drum de acces de 2,4 km și a rețelelor de apă, canalizare și electrice pentru un parc industrial.',
    source_url: 'https://e-licitatie.ro/CN1064762',
    authority: 'CNAIR',
    county: 'București',
    procedure_type: 'restricted',
    clarification_deadline: '2026-10-28',
    state: {
      score: 91,
      score_reasons: [
        'Both CPV codes match your road and utility history',
        'Value RON 6.8M is within your annual capacity',
        'Restricted procedure: you meet the shortlist criteria',
      ],
      ai_summary:
        'A 2.4 km access road with water, sewer and power networks. Contract split in two phases of 9 months each.',
      ai_title_simplified: 'Access road and utility networks for an industrial park',
      extracted_requirements: [
        'Minimum 3 road or utility contracts of RON 3M or more in the last 5 years',
        'ISO 9001, ISO 14001 and ISO 45001 certified',
        'Road-works and utility-networks authorizations',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'Minimum 3 road or utility contracts of RON 3M or more in the last 5 years',
        'ISO 9001, ISO 14001 and ISO 45001 certified',
        'Road-works and utility-networks authorizations',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'Fully covered: matching references, valid ISO certificates and the required authorizations.',
      missing_documents: [],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1065448',
    country_code: 'RO',
    title: 'Reparații capitale și amenajare centru social',
    cpv_codes: ['45454000',  '45262500'],
    estimated_value: 950000,
    currency: 'RON',
    publication_date: '2026-10-24',
    submission_deadline: '2026-10-31',
    raw_description:
      'Lucrări de reparații capitale, compartimentare, finisaje și instalații pentru un centru social cu 60 de locuri.',
    source_url: 'https://e-licitatie.ro/CN1065448',
    authority: 'DGASPC Sector 3',
    county: 'București',
    procedure_type: 'open',
    clarification_deadline: null, // direct awards often skip this (real SEAP case)
    state: {
      score: 22,
      score_reasons: [
        'CPV 45454000 is outside your core project types',
        'Value RON 950K is well below your capacity',
        'Deadline is close',
      ],
      ai_summary:
        'Major repairs, partitioning, finishes and installations for a 60-bed social care center. 8-month schedule.',
      ai_title_simplified: 'Major repairs and fit-out of a social care center',
      extracted_requirements: [
        'Minimum 1 healthcare or social building refurbishment',
        'Class II building authorization',
      ],
      eligible: false,
      country_authorization_status: null,
      matched_requirements: [
        'Class II building authorization',
      ],
      unmet_requirements: [
        'Minimum 1 healthcare or social building refurbishment',
      ],
      eligibility_justification:
        'Weak match: no healthcare or social building reference in your profile.',
      missing_documents: [
        'Healthcare or social building reference contract',
      ],
      status: 'new',
    },
  },
  {
    source_system: S,
    external_id: 'CN1064559',
    country_code: 'RO',
    title: 'Acord-cadru lucrări de întreținere și reparații clădiri campus — 24 luni',
    cpv_codes: ['45453000',  '50700000'],
    estimated_value: 1900000,
    currency: 'RON',
    publication_date: '2026-09-28',
    submission_deadline: '2026-12-18',
    raw_description:
      'Acord-cadru pentru lucrări curente de întreținere și reparații la clădirile campusului universitar, pe 24 de luni.',
    source_url: 'https://e-licitatie.ro/CN1064559',
    authority: 'Universitatea Babeș-Bolyai',
    county: 'Cluj',
    procedure_type: 'framework',
    clarification_deadline: '2026-12-01',
    state: {
      score: 79,
      score_reasons: [
        'CPV 45453000 matches your maintenance and repair history',
        'Local execution (Cluj) is in your registered county',
        'Framework fits steady capacity planning',
      ],
      ai_summary:
        'A 24-month framework for routine maintenance and repairs across campus buildings, with call-off orders and a 48-hour response time.',
      ai_title_simplified: 'Campus building maintenance and repairs framework (24 months)',
      extracted_requirements: [
        'Minimum 2 framework or maintenance contracts in the last 3 years',
        '48-hour response time for urgent repairs',
        'Local crew base in Cluj county',
      ],
      eligible: true,
      country_authorization_status: null,
      matched_requirements: [
        'Minimum 2 framework or maintenance contracts in the last 3 years',
        '48-hour response time for urgent repairs',
        'Local crew base in Cluj county',
      ],
      unmet_requirements: [],
      eligibility_justification:
        'Fully covered: you run a Cluj crew and hold comparable framework contracts.',
      missing_documents: [],
      status: 'new',
    },
  },
];

export const MOCK_COMPANY: CompanyProfile = {
  id: 1,
  name: 'SC Transilvania Construct SRL',
  cui: 'RO18402933',
  industry: 'construction',
  founded_year: 2012,
  team_size: 45,
  cpv_codes: ['45214200', '45233120', '45221111', '45232410', '45453000'],
  secondary_cpv_codes: [],
  annual_capacity: 15000000,
  certifications: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ANAF fiscal compliance'],
  blacklist_keywords: ['catering', 'software', 'furnizare'],
  annual_turnover: 15000000,
  annual_turnover_currency: 'RON',
  similar_experience_value: 22000000,
  similar_experience_currency: 'RON',
  similar_experience_contract_count: 6,
  target_countries: ['RO'],
  keywords: ['road-works', 'maintenance'],
  website: null,
  subsectors: [],
  annual_capacity_currency: 'RON',
  team_eu_count: null,
  team_non_eu_count: null,
};

export const MOCK_EVIDENCE: EvidenceDocument[] = [
  { id: 'ev1', name: 'ANAF Fiscal Compliance Certificate', type: 'Fiscal', valid_until: '2027-03-31' },
  { id: 'ev2', name: 'ISO 9001:2015 Certificate', type: 'Quality', valid_until: '2027-11-20' },
  { id: 'ev3', name: 'ISO 45001:2018 Certificate', type: 'Safety', valid_until: '2026-12-15' },
  { id: 'ev4', name: 'ONRC Company Certificate (certificat constatator)', type: 'Legal', valid_until: '2026-11-30' },
  { id: 'ev5', name: 'Reference contract — school renovation 2024', type: 'Reference', valid_until: null },
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
