import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export type Lang = 'en' | 'ro';

/** Canonical origin. Vercel previews keep their own URL through the env var. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://licits.com').replace(/\/$/, '');

export const toLang = (locale: string): Lang => (locale === 'ro' ? 'ro' : 'en');

/** Absolute URL of a page in a locale. `path` starts with "/" or is empty for the home page. */
export const pageUrl = (locale: string, path = '') => `${SITE_URL}/${locale}${path}`;

/** Pages that search engines and AI crawlers may index. */
export const PUBLIC_PATHS = ['', '/pricing', '/about', '/contact', '/resources', '/privacy', '/terms'] as const;

const SITE_NAME = 'Licits';

/** Titles and descriptions of the marketing pages. Resource articles carry their own. */
export const PAGE_META: Record<string, Record<Lang, { title: string; description: string }>> = {
  '': {
    en: {
      title: 'Licits | Win the public construction tenders you have been missing',
      description:
        'Licits reads every SEAP notice for construction works, shows which tenders your company can win, and drafts the offer with you. Built for Romanian contractors, including firms new to public tenders.',
    },
    ro: {
      title: 'Licits | Câștigă licitațiile publice de construcții pe care le-ai ratat',
      description:
        'Licits citește fiecare anunț SEAP pentru lucrări de construcții, îți arată ce licitații poate câștiga firma ta și redactează oferta împreună cu tine. Pentru constructorii din România, inclusiv firmele noi în licitații publice.',
    },
  },
  '/pricing': {
    en: {
      title: 'Pricing | Licits',
      description:
        'Simple monthly plans for Romanian construction companies bidding on public tenders. Join the waitlist and start with two weeks free on any plan.',
    },
    ro: {
      title: 'Prețuri | Licits',
      description:
        'Planuri lunare simple pentru firmele de construcții din România care participă la licitații publice. Înscrie-te pe lista de așteptare și primești două săptămâni gratuite.',
    },
  },
  '/about': {
    en: {
      title: 'About Licits | Public works go to the firms that see them first',
      description:
        'Licits is built for Romanian construction companies. It reads every SEAP works notice, checks eligibility and drafts the offer, and never submits for you.',
    },
    ro: {
      title: 'Despre Licits | Lucrările publice merg la firmele care le văd primele',
      description:
        'Licits este construit pentru firmele de construcții din România. Citește fiecare anunț SEAP de lucrări, verifică eligibilitatea și redactează oferta, fără să depună niciodată în locul tău.',
    },
  },
  '/contact': {
    en: { title: 'Contact | Licits', description: 'Write to the Licits team: questions, pilot access or feedback. A person replies by email.' },
    ro: { title: 'Contact | Licits', description: 'Scrie echipei Licits: întrebări, acces pilot sau feedback. Îți răspunde un om, pe email.' },
  },
  '/resources': {
    en: {
      title: 'Resources | How to win public tenders in Romania',
      description:
        'Plain-language guides for construction companies new to Romanian public tenders: SEAP, digital signature, DUAE, qualification requirements, common mistakes, consultants vs software.',
    },
    ro: {
      title: 'Resurse | Cum câștigi licitații publice în România',
      description:
        'Ghiduri pe înțelesul tuturor pentru firmele de construcții noi în licitațiile publice din România: SEAP, semnătură electronică, DUAE, cerințe de calificare, greșeli frecvente, consultant sau software.',
    },
  },
  '/privacy': {
    en: { title: 'Privacy notice | Licits', description: 'How Licits collects, uses and protects personal data and confidential company data, who it is shared with, and the rights you have.' },
    ro: { title: 'Notă de confidențialitate | Licits', description: 'Cum colectează, folosește și protejează Licits datele personale și datele confidențiale ale companiilor, cu cine le împarte și ce drepturi ai.' },
  },
  '/terms': {
    en: { title: 'Terms of use | Licits', description: 'The terms for using the Licits early-access pilot: who it is for, what it does and does not do, your content, acceptable use, and liability.' },
    ro: { title: 'Termeni de utilizare | Licits', description: 'Termenii de utilizare a pilotului Licits în acces anticipat: pentru cine este, ce face și ce nu face, conținutul tău, utilizarea acceptabilă și răspunderea.' },
  },
};

/** hreflang alternates for a path, with x-default on English. */
export const alternates = (path = '') => ({
  canonical: undefined as string | undefined,
  languages: {
    ...Object.fromEntries(routing.locales.map((l) => [l, pageUrl(l, path)])),
    'x-default': pageUrl(routing.defaultLocale, path),
  },
});

/** Full metadata for a page: canonical, hreflang, Open Graph and Twitter. */
export function buildMetadata(opts: {
  locale: string;
  path?: string;
  title: string;
  description: string;
  type?: 'website' | 'article';
  published?: string;
  updated?: string;
}): Metadata {
  const { locale, path = '', title, description, type = 'website', published, updated } = opts;
  const lang = toLang(locale);
  const url = pageUrl(lang, path);
  const alt = alternates(path);
  return {
    title,
    description,
    alternates: { canonical: url, languages: alt.languages },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title,
      description,
      locale: lang === 'ro' ? 'ro_RO' : 'en_US',
      alternateLocale: lang === 'ro' ? 'en_US' : 'ro_RO',
      ...(type === 'article' && published ? { publishedTime: published, modifiedTime: updated ?? published } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Metadata for one of the marketing pages in PAGE_META. */
export function pageMetadata(locale: string, path = ''): Metadata {
  const m = PAGE_META[path][toLang(locale)];
  return buildMetadata({ locale, path, ...m });
}
