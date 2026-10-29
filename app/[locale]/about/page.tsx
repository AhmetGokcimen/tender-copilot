import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { SitePage } from '@/components/landing/SitePage';

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  return (
    <SitePage>
      <div className="flex flex-col gap-space-lg">
        <header className="flex flex-col gap-space-sm">
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-on-surface md:text-5xl">
            {t('title')}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t('intro')}</p>
        </header>
        <section className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface">{t('problemTitle')}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('problemBody')}</p>
        </section>
        <section className="flex flex-col gap-space-sm rounded-xl bg-navy p-space-lg text-white shadow-sm">
          <h2 className="font-headline-md text-headline-md">{t('whatTitle')}</h2>
          <ul className="flex flex-col gap-space-xs">
            {[t('what1'), t('what2'), t('what3'), t('what4')].map((w) => (
              <li key={w} className="flex items-start gap-space-sm font-body-md text-body-md text-white/85">
                <Icon name="check_circle" size="sm" className="mt-0.5 shrink-0 text-accent" />
                {w}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface">{t('honestTitle')}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('honestBody')}</p>
        </section>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Link
            href="/auth/signup"
            className="inline-flex h-11 items-center rounded-lg bg-navy px-space-lg font-label-md text-label-md font-semibold text-white hover:bg-navy-deep"
          >
            {t('ctaSignup')}
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center rounded-lg border border-outline-variant px-space-lg font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
          >
            {t('ctaContact')}
          </Link>
        </div>
      </div>
    </SitePage>
  );
}
