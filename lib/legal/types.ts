export type LegalRow = { t: string; d: string; w: string; b: string; k: string };

export type LegalSection = {
  id: string;
  h: string;
  p?: string[];
  /** Data inventory rows, shown as cards: what, why, legal basis, how long. */
  rows?: LegalRow[];
  list?: string[];
  /** Paragraphs shown after the list. */
  p2?: string[];
};

export type LegalDoc = {
  title: string;
  description: string;
  /** ISO date of the last change to the text. */
  updated: string;
  intro: string;
  sections: LegalSection[];
};
