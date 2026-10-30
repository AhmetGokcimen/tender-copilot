import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { JsonLd } from '@/components/seo/JsonLd';
import { SitePage } from '@/components/landing/SitePage';
import { RESOURCES } from '@/lib/resources';
import { breadcrumbs, collectionSchema } from '@/lib/schema';
import { PAGE_META, pageMetadata, toLang } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/resources');
}

/** Hub of guides for companies new to Romanian public tenders. */
export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = toLang(locale);
  const t = await getTranslations('resources');
  const meta = PAGE_META['/resources'][lang];
  return (
    <SitePage>
      <JsonLd data={collectionSchema(lang, meta.title, meta.description, RESOURCES)} />
      <JsonLd data={breadcrumbs(lang, [{ name: t('home'), path: '' }, { name: t('title'), path: '/resources' }])} />
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <h1 className="max-w-2xl text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[48px] md:leading-[52px] md:tracking-[-1.6px]">
            {t('title')}
          </h1>
          <p className="max-w-[60ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">{t('sub')}</p>
        </header>
        <ul className="grid gap-4">
          {RESOURCES.map((a) => (
            <li key={a.slug}>
              <article className="group relative rounded-card border border-line bg-raised p-6 transition-shadow hover:shadow-lift-2 md:p-7">
                <p className="font-mono text-[12px] text-muted">{t('minutes', { n: a.minutes })}</p>
                <h2 className="mt-2 text-[22px] font-normal leading-7 tracking-[-0.4px] text-ink">
                  <Link
                    href={`/resources/${a.slug}`}
                    className="after:absolute after:inset-0"
                  >
                    {a[lang].title}
                  </Link>
                </h2>
                <p className="mt-2 text-[15px] leading-[24px] text-ink-2">{a[lang].answer.split('. ')[0]}.</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </SitePage>
  );
}
