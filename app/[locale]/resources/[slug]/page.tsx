import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, Link } from '@/i18n/routing';
import { JsonLd } from '@/components/seo/JsonLd';
import { SitePage } from '@/components/landing/SitePage';
import { buttonClass } from '@/components/ui/Button';
import { RESOURCES, getArticle, related } from '@/lib/resources';
import { articleSchema, breadcrumbs, faqPage } from '@/lib/schema';
import { buildMetadata, toLang } from '@/lib/seo';

type Params = { locale: string; slug: string };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => RESOURCES.map((a) => ({ locale, slug: a.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  const c = a[toLang(locale)];
  return buildMetadata({
    locale,
    path: `/resources/${slug}`,
    title: `${c.title} | Licits`,
    description: c.description,
    type: 'article',
    published: a.published,
    updated: a.updated,
  });
}

const H2 = 'text-[26px] font-light leading-[32px] tracking-[-0.7px] text-ink md:text-[30px] md:leading-[36px]';
const P = 'text-[16px] leading-[27px] text-ink-2';

/** One guide: a direct answer first, then sections, questions, sources and a reviewed date. */
export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const a = getArticle(slug);
  if (!a) notFound();
  const lang = toLang(locale);
  const c = a[lang];
  const other = lang === 'en' ? 'ro' : 'en';
  const t = await getTranslations('resources');
  const date = new Intl.DateTimeFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', { dateStyle: 'long' }).format(new Date(a.updated));

  return (
    <SitePage>
      <JsonLd data={articleSchema(a, lang)} />
      <JsonLd data={faqPage(c.faq)} />
      <JsonLd
        data={breadcrumbs(lang, [
          { name: t('home'), path: '' },
          { name: t('title'), path: '/resources' },
          { name: c.title, path: `/resources/${slug}` },
        ])}
      />
      <article className="flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
            <Link href="/resources" className="hover:text-ink">
              {t('title')}
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span>{c.title}</span>
          </nav>
          <h1 className="text-[34px] font-light leading-[1.1] tracking-[-1.1px] text-ink md:text-[46px] md:leading-[50px] md:tracking-[-1.5px]">
            {c.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-muted">
            <span>
              {t('updated')} <time dateTime={a.updated}>{date}</time>
            </span>
            <span>{t('minutes', { n: a.minutes })}</span>
            <Link href={`/resources/${slug}`} locale={other} hrefLang={other} lang={other} className="text-indigo-text hover:underline">
              {t('readIn')}
            </Link>
          </p>
        </header>

        <aside className="rounded-card bg-indigo-soft p-6 md:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-indigo-text">{t('inShort')}</p>
          <p className="mt-2 text-[17px] leading-[28px] text-ink">{c.answer}</p>
        </aside>

        {c.sections.map((s) => (
          <section key={s.h} className="flex flex-col gap-4">
            <h2 className={H2}>{s.h}</h2>
            {s.p?.map((p) => (
              <p key={p} className={P}>
                {p}
              </p>
            ))}
            {s.list && (
              <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-indigo">
                {s.list.map((i) => (
                  <li key={i} className={P}>
                    {i}
                  </li>
                ))}
              </ul>
            )}
            {s.steps && (
              <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-mono marker:text-indigo-text">
                {s.steps.map((i) => (
                  <li key={i} className={P}>
                    {i}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}

        <section className="flex flex-col gap-5">
          <h2 className={H2}>{t('faq')}</h2>
          <dl className="flex flex-col gap-5">
            {c.faq.map((f) => (
              <div key={f.q}>
                <dt className="text-[17px] font-medium text-ink">{f.q}</dt>
                <dd className={`mt-1 ${P}`}>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium text-ink">{t('sources')}</h2>
          <ul className="flex flex-col gap-1.5">
            {c.sources.map((s) => (
              <li key={s.url} className="text-[15px]">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-indigo-text underline-offset-4 hover:underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] leading-[20px] text-muted">{t('disclaimer', { date })}</p>
        </section>

        <section className="flex flex-col gap-3 rounded-card bg-night p-6 text-on-night md:p-8">
          <h2 className="text-[22px] font-normal leading-7 tracking-[-0.4px]">{t('ctaTitle')}</h2>
          <p className="max-w-[56ch] text-[15px] leading-[24px] text-on-night/80">{t('ctaBody')}</p>
          <div className="pt-2">
            <Link href="/#waitlist" className={buttonClass({ variant: 'inverse' })}>
              {t('ctaButton')}
            </Link>
          </div>
        </section>

        <nav aria-label={t('related')} className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium text-ink">{t('related')}</h2>
          <ul className="flex flex-col gap-1.5">
            {related(slug).map((r) => (
              <li key={r.slug}>
                <Link href={`/resources/${r.slug}`} className="text-[15px] text-indigo-text underline-offset-4 hover:underline">
                  {r[lang].title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </SitePage>
  );
}
