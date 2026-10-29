'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SITE } from '@/lib/site';
import { Logo } from '../brand/Logo';

const LINK = 'text-[14px] text-ink-2 transition-colors hover:text-ink';
const HEAD = 'text-[13px] font-semibold text-ink';

export function Footer() {
  const t = useTranslations('landing');
  return (
    <footer className="relative z-10 border-t border-line bg-surface/85">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:px-8">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <Logo />
          <p className="max-w-xs text-[14px] leading-[21px] text-muted">{t('footerTag')}</p>
          {SITE.email && (
            <a href={`mailto:${SITE.email}`} className={LINK}>
              {SITE.email}
            </a>
          )}
        </div>
        <nav aria-label={t('footerProduct')} className="flex flex-col gap-2.5">
          <span className={HEAD}>{t('footerProduct')}</span>
          <Link href="/#how" className={LINK}>
            {t('footerHow')}
          </Link>
          <Link href="/#faq" className={LINK}>
            {t('footerFaq')}
          </Link>
          <Link href="/pricing" className={LINK}>
            {t('footerPricing')}
          </Link>
        </nav>
        <nav aria-label={t('footerCompany')} className="flex flex-col gap-2.5">
          <span className={HEAD}>{t('footerCompany')}</span>
          <Link href="/about" className={LINK}>
            {t('footerAbout')}
          </Link>
          <Link href="/contact" className={LINK}>
            {t('footerContact')}
          </Link>
        </nav>
        <nav aria-label={t('footerLegal')} className="flex flex-col gap-2.5">
          <span className={HEAD}>{t('footerLegal')}</span>
          <Link href="/privacy" className={LINK}>
            {t('footerPrivacy')}
          </Link>
          <Link href="/terms" className={LINK}>
            {t('footerTerms')}
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-4 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between md:px-8">
          <span>{t('footerRights')}</span>
          <span>{t('footerHackathon')}</span>
        </div>
      </div>
    </footer>
  );
}
