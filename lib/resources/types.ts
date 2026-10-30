export type Lang = 'en' | 'ro';

export type Section = {
  /** Section heading (h2). */
  h: string;
  /** Paragraphs, in order. */
  p?: string[];
  /** Optional bullet list shown after the paragraphs. */
  list?: string[];
  /** Optional numbered steps shown after the paragraphs. */
  steps?: string[];
};

export type Source = { label: string; url: string };

export type ArticleCopy = {
  title: string;
  /** Meta description, about 150 characters. */
  description: string;
  /** Direct answer in two or three sentences, shown first and quoted by AI answers. */
  answer: string;
  sections: Section[];
  /** Questions answered in the article, also emitted as FAQ structured data. */
  faq: { q: string; a: string }[];
  sources: Source[];
};

export type Article = {
  slug: string;
  /** ISO date of first publication and last review. */
  published: string;
  updated: string;
  /** Read time in minutes. */
  minutes: number;
  en: ArticleCopy;
  ro: ArticleCopy;
};
