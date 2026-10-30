import { SITE_URL, pageUrl, type Lang } from '@/lib/seo';
import type { Article } from '@/lib/resources';

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

const DESCRIPTION: Record<Lang, string> = {
  en: 'Licits is software for Romanian construction companies that reads every SEAP notice for works, shows which public tenders the company can win, and drafts the offer and DUAE with it. It never submits for the company.',
  ro: 'Licits este un software pentru firmele de construcții din România care citește fiecare anunț SEAP de lucrări, arată ce licitații publice poate câștiga firma și redactează oferta și DUAE împreună cu ea. Nu depune niciodată în locul firmei.',
};

/** Organization + WebSite + SoftwareApplication, linked by @id. Emitted on the home page. */
export function siteGraph(lang: Lang) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'Licits',
        alternateName: 'Licits.com',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon.svg`,
        description: DESCRIPTION[lang],
        areaServed: { '@type': 'Country', name: 'Romania' },
        knowsAbout: [
          'Romanian public procurement',
          'SEAP and SICAP',
          'Construction tenders',
          'DUAE (ESPD)',
          'Tender eligibility',
          'Licitații publice',
          'Achiziții publice de lucrări',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        url: `${SITE_URL}/`,
        name: 'Licits',
        inLanguage: ['en', 'ro'],
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: 'Licits',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: DESCRIPTION[lang],
        url: pageUrl(lang),
        inLanguage: ['en', 'ro'],
        provider: { '@id': ORG_ID },
        audience: {
          '@type': 'BusinessAudience',
          audienceType:
            lang === 'ro'
              ? 'Firme de construcții din România, inclusiv firme noi în licitații publice'
              : 'Romanian construction companies, including firms new to public tenders',
        },
        featureList:
          lang === 'ro'
            ? [
                'Citește fiecare anunț SEAP de lucrări de construcții',
                'Verifică eligibilitatea cerință cu cerință, cu motive clare',
                'Redactează oferta și DUAE din documentele firmei',
                'Urmărește ofertele într-un flux de lucru până la depunere',
              ]
            : [
                'Reads every SEAP notice for construction works',
                'Checks eligibility requirement by requirement, with clear reasons',
                'Drafts the offer and DUAE from the company’s own documents',
                'Tracks bids in a pipeline until submission',
              ],
      },
    ],
  };
}

/** FAQPage from question/answer pairs. */
export function faqPage(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export function breadcrumbs(lang: Lang, trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: pageUrl(lang, t.path),
    })),
  };
}

/** Article for a resource guide, with the sources it cites. */
export function articleSchema(a: Article, lang: Lang) {
  const c = a[lang];
  const url = pageUrl(lang, `/resources/${a.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: c.title,
    description: c.description,
    abstract: c.answer,
    inLanguage: lang,
    url,
    mainEntityOfPage: url,
    datePublished: a.published,
    dateModified: a.updated,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    isAccessibleForFree: true,
    citation: c.sources.map((s) => ({ '@type': 'CreativeWork', name: s.label, url: s.url })),
    ...(lang === 'en'
      ? { workTranslation: { '@type': 'Article', url: pageUrl('ro', `/resources/${a.slug}`), inLanguage: 'ro' } }
      : { workTranslation: { '@type': 'Article', url: pageUrl('en', `/resources/${a.slug}`), inLanguage: 'en' } }),
  };
}

export function collectionSchema(lang: Lang, name: string, description: string, articles: Article[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: pageUrl(lang, '/resources'),
    inLanguage: lang,
    isPartOf: { '@id': SITE_ID },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: pageUrl(lang, `/resources/${a.slug}`),
        name: a[lang].title,
      })),
    },
  };
}

/** A plain page (About, Pricing, Contact) with its place in the site. */
export function webPage(
  lang: Lang,
  type: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage',
  path: string,
  name: string,
  description: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url: pageUrl(lang, path),
    inLanguage: lang,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
  };
}
