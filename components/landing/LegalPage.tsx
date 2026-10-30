import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { SitePage } from './SitePage';

/** Shared body for the Terms and Privacy pages (stub copy until legal text lands). */
export async function LegalPage({ titleKey }: { titleKey: 'privacyTitle' | 'termsTitle' }) {
  const t = await getTranslations('legal');
  return (
    <SitePage>
      <div className="flex flex-col gap-6">
        <h1 className="max-w-2xl text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[48px] md:leading-[52px] md:tracking-[-1.6px]">
          {t(titleKey)}
        </h1>
        <div className="flex flex-col gap-3 rounded-card border border-line bg-raised p-6 md:p-8">
          <p className="text-[15px] leading-[24px] text-ink-2">{t('stubBody')}</p>
          <p className="text-[15px] leading-[24px] text-ink-2">
            {t('contactLine')}{' '}
            <Link href="/contact" className="font-medium text-indigo-text hover:underline">
              Contact
            </Link>
          </p>
        </div>
      </div>
    </SitePage>
  );
}
