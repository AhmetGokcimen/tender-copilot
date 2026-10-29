import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { SitePage } from '@/components/landing/SitePage';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');
  return (
    <SitePage>
      <div className="flex flex-col gap-space-md">
        <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-on-surface md:text-5xl">
          {t('termsTitle')}
        </h1>
        <div className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
          <p className="font-body-md text-body-md text-on-surface-variant">{t('stubBody')}</p>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('contactLine')}{' '}
            <Link href="/contact" className="font-semibold text-navy hover:underline">
              Contact
            </Link>
          </p>
        </div>
      </div>
    </SitePage>
  );
}
