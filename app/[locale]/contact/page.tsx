import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { SitePage } from '@/components/landing/SitePage';

/**
 * No form-submission backend exists in this project (verified: no contact/
 * message endpoints), and no public email was provided — so this page
 * routes pilot interest through signup instead of a form that silently
 * fails or a placeholder address.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
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
          <h2 className="font-headline-md text-headline-md">{t('pilotTitle')}</h2>
          <p className="font-body-md text-body-md text-white/80">{t('pilotBody')}</p>
          <div className="pt-space-xs">
            <Link
              href="/auth/signup"
              className="inline-flex h-11 items-center rounded-lg bg-white px-space-lg font-label-md text-label-md font-semibold text-navy hover:bg-surface-container-high"
            >
              {t('ctaSignup')}
            </Link>
          </div>
        </section>
        <p className="flex items-start gap-space-sm font-body-md text-body-md text-on-surface-variant">
          <Icon name="info" size="sm" className="mt-0.5 shrink-0 text-navy" />
          {t('noEmail')}
        </p>
      </div>
    </SitePage>
  );
}
