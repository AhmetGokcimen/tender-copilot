import { RESOURCES, type Lang } from '@/lib/resources';
import { SITE_URL, pageUrl } from '@/lib/seo';

const ABOUT: Record<Lang, string> = {
  en: 'Licits is software for Romanian construction companies. It reads every SEAP notice for construction works (CPV 45), checks which tenders a company can win, requirement by requirement, and drafts the offer and DUAE from the company’s own documents. It is built for contractors that are new to public tenders and for firms that used to depend on tender consultants. It does not give legal advice and never submits an offer for the company: the user reviews everything and submits on SEAP.',
  ro: 'Licits este un software pentru firmele de construcții din România. Citește fiecare anunț SEAP pentru lucrări de construcții (CPV 45), verifică ce licitații poate câștiga o firmă, cerință cu cerință, și redactează oferta și DUAE din documentele firmei. Este construit pentru constructorii noi în licitații publice și pentru firmele care depindeau de consultanți. Nu oferă consultanță juridică și nu depune niciodată oferta în locul firmei: utilizatorul verifică tot și depune în SEAP.',
};

/** /llms.txt: a short, curated map of the site for language models (llmstxt.org format). */
export function llmsIndex(): string {
  const lines = [
    '# Licits',
    '',
    `> ${ABOUT.en}`,
    '',
    `${ABOUT.ro}`,
    '',
    '## Product',
    '',
    `- [Licits home (English)](${pageUrl('en')}): what Licits does and who it is for`,
    `- [Licits acasă (română)](${pageUrl('ro')}): ce face Licits și pentru cine este`,
    `- [Pricing](${pageUrl('en', '/pricing')}): plans and the two-week free start for the waitlist`,
    `- [About](${pageUrl('en', '/about')}) / [Despre noi](${pageUrl('ro', '/about')}): why Licits exists and what it believes`,
    '',
    '## Guides for companies new to Romanian public tenders (English)',
    '',
    ...RESOURCES.map((a) => `- [${a.en.title}](${pageUrl('en', `/resources/${a.slug}`)}): ${a.en.description}`),
    '',
    '## Ghiduri pentru firmele noi în licitațiile publice din România (română)',
    '',
    ...RESOURCES.map((a) => `- [${a.ro.title}](${pageUrl('ro', `/resources/${a.slug}`)}): ${a.ro.description}`),
    '',
    '## Optional',
    '',
    `- [Full text of all guides](${SITE_URL}/llms-full.txt): every guide in English and Romanian, in one file`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    `- [Contact](${pageUrl('en', '/contact')})`,
    '',
  ];
  return lines.join('\n');
}

/** /llms-full.txt: the full text of every guide, in both languages. */
export function llmsFull(): string {
  const out = ['# Licits: full text of the guides', '', `> ${ABOUT.en}`, ''];
  for (const lang of ['en', 'ro'] as const) {
    out.push(lang === 'en' ? '# English guides' : '# Ghiduri în română', '');
    for (const a of RESOURCES) {
      const c = a[lang];
      out.push(`## ${c.title}`, '', `URL: ${pageUrl(lang, `/resources/${a.slug}`)}`, `Updated: ${a.updated}`, '', c.answer, '');
      for (const s of c.sections) {
        out.push(`### ${s.h}`, '');
        for (const p of s.p ?? []) out.push(p, '');
        for (const i of s.list ?? []) out.push(`- ${i}`);
        if (s.list) out.push('');
        (s.steps ?? []).forEach((i, n) => out.push(`${n + 1}. ${i}`));
        if (s.steps) out.push('');
      }
      out.push(lang === 'en' ? '### Questions' : '### Întrebări', '');
      for (const f of c.faq) out.push(`**${f.q}**`, f.a, '');
      out.push(lang === 'en' ? '### Sources' : '### Surse', '');
      for (const s of c.sources) out.push(`- [${s.label}](${s.url})`);
      out.push('');
    }
  }
  return out.join('\n');
}
