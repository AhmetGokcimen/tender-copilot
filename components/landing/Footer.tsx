'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SITE } from '@/lib/site';
import { Icon } from '../Icon';

const LINK = 'font-body-md text-body-md text-white/70 hover:text-white';
const HEAD = 'font-label-md text-label-md font-semibold uppercase tracking-wider text-white/50';

export function Footer() {
  const t = useTranslations('landing');
  return (
    <footer className="border-t border-white/10 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-space-lg px-margin py-space-xl md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-margin-desktop">
        <div className="col-span-2 flex flex-col gap-space-sm md:col-span-1">
          <div className="flex items-center gap-space-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-headline-sm text-headline-sm font-bold text-navy">
              O
            </span>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight">Ofera</span>
          </div>
          <p className="max-w-xs font-body-sm text-body-sm text-white/60">{t('footerTag')}</p>
          {(SITE.github || SITE.email) && (
            <div className="flex items-center gap-space-md">
              {SITE.github && (
                <a
                  href={SITE.github}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-space-xs font-body-md text-body-md text-white/80 hover:text-white"
                >
                  <Icon name="code" size="sm" />
                  GitHub
                </a>
              )}
              {SITE.email && (
                <a
                  href={`mailto:${SITE.email}`}
                  className="flex items-center gap-space-xs font-body-md text-body-md text-white/80 hover:text-white"
                >
                  <Icon name="mail" size="sm" />
                  {SITE.email}
                </a>
              )}
            </div>
          )}
        </div>
        <nav aria-label={t('footerProduct')} className="flex flex-col gap-space-xs">
          <span className={HEAD}>{t('footerProduct')}</span>
          <Link href="/#how" className={LINK}>
            {t('footerHow')}
          </Link>
          <Link href="/#agents" className={LINK}>
            {t('footerAgents')}
          </Link>
          <Link href="/#principles" className={LINK}>
            {t('footerPrinciples')}
          </Link>
        </nav>
        <nav aria-label={t('footerCompany')} className="flex flex-col gap-space-xs">
          <span className={HEAD}>{t('footerCompany')}</span>
          <Link href="/about" className={LINK}>
            {t('footerAbout')}
          </Link>
          <Link href="/pricing" className={LINK}>
            {t('footerPricing')}
          </Link>
          <Link href="/contact" className={LINK}>
            {t('footerContact')}
          </Link>
        </nav>
        <nav aria-label={t('footerLegal')} className="flex flex-col gap-space-xs">
          <span className={HEAD}>{t('footerLegal')}</span>
          <Link href="/privacy" className={LINK}>
            {t('footerPrivacy')}
          </Link>
          <Link href="/terms" className={LINK}>
            {t('footerTerms')}
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-margin py-space-sm font-body-sm text-body-sm text-white/50 sm:flex-row sm:items-center sm:justify-between lg:px-margin-desktop">
          <span>{t('footerRights')}</span>
          <span>{t('footerHackathon')}</span>
        </div>
      </div>
    </footer>
  );
}
