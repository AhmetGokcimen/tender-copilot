import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { SitePage } from '@/components/landing/SitePage';

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pricing');
  return (
    <SitePage>
      <div className="flex flex-col gap-space-lg">
        <header className="flex flex-col gap-space-sm">
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-on-surface md:text-5xl">
            {t('title')}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t('sub')}</p>
        </header>
        <section className="flex flex-col gap-space-sm rounded-xl bg-navy p-space-lg text-white shadow-sm">
          <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-accent">
            {t('planName')}
          </span>
          <p className="font-headline-lg text-headline-lg tracking-tight">{t('planPrice')}</p>
          <p className="font-body-md text-body-md text-white/80">{t('planBody')}</p>
          <div className="pt-space-xs">
            <Link
              href="/auth/signup"
              className="inline-flex h-11 items-center rounded-lg bg-white px-space-lg font-label-md text-label-md font-semibold text-navy hover:bg-surface-container-high"
            >
              {t('planCta')}
            </Link>
          </div>
        </section>
        <section className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface">{t('includedTitle')}</h2>
          <ul className="flex flex-col gap-space-xs">
            {[t('included1'), t('included2'), t('included3'), t('included4')].map((w) => (
              <li key={w} className="flex items-start gap-space-sm font-body-md text-body-md text-on-surface">
                <Icon name="check_circle" size="sm" className="mt-0.5 shrink-0 text-success" />
                {w}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface">{t('laterTitle')}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('laterBody')}</p>
          <div className="pt-space-xs">
            <Link
              href="/contact"
              className="inline-flex h-10 items-center rounded-lg border border-outline-variant px-space-md font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
            >
              {t('contactCta')}
            </Link>
          </div>
        </section>
      </div>
    </SitePage>
  );
}
