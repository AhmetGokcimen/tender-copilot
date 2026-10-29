/**
 * Curated CPV (Common Procurement Vocabulary) descriptions for the codes the
 * product actually works with: every division suggested by the backend
 * industry/keyword lookups plus a few common subdivisions so manual search
 * feels real. Labels follow the official EU CPV nomenclature wording.
 * Unknown codes fall back to a bare "CPV {code}" label — never invented.
 */

export const CPV_DESCRIPTIONS: Record<string, string> = {
  '09000000': 'Petroleum products, fuel, electricity and other sources of energy',
  '09300000': 'Electricity, heating, solar and nuclear energy',
  '30200000': 'Computer equipment and supplies',
  '30210000': 'Data-processing machines (hardware)',
  '30230000': 'Computer-related equipment',
  '33000000': 'Medical equipments, pharmaceuticals and personal care products',
  '33100000': 'Medical equipments',
  '33600000': 'Pharmaceutical products',
  '39100000': 'Furniture',
  '45000000': 'Construction work',
  '45210000': 'Building construction work',
  '45233120': 'Road construction works',
  '48000000': 'Software package and information systems',
  '48100000': 'Industry specific software package',
  '48200000': 'Networking, Internet and intranet software package',
  '50300000': 'Repair and maintenance services of computers',
  '55500000': 'Canteen and catering services',
  '55520000': 'Catering services',
  '60000000': 'Transport services (excl. waste transport)',
  '60100000': 'Land transport services',
  '72200000': 'Software programming and consultancy services',
  '72260000': 'Software-related services',
  '79400000': 'Business and management consultancy and related services',
  '79410000': 'Business and management consultancy services',
  '79700000': 'Investigation and security services',
  '79710000': 'Security services',
  '79900000': 'Miscellaneous business and business-related services',
};

export function cpvLabel(code: string): string {
  return CPV_DESCRIPTIONS[code] ?? `CPV ${code}`;
}

/** Search the known CPV universe by code prefix or label words (max 12). */
export function searchCpv(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const codes = Object.keys(CPV_DESCRIPTIONS);
  const byCode = codes.filter((c) => c.startsWith(q.replace(/\s+/g, '')));
  const byLabel = codes.filter(
    (c) => !byCode.includes(c) && CPV_DESCRIPTIONS[c].toLowerCase().includes(q),
  );
  return [...byCode, ...byLabel].slice(0, 12);
}
