import privacy from './privacy.json';
import terms from './terms.json';
import type { LegalDoc } from './types';

export type { LegalDoc, LegalSection, LegalRow } from './types';

export const PRIVACY = privacy as { en: LegalDoc; ro: LegalDoc };
export const TERMS = terms as { en: LegalDoc; ro: LegalDoc };
