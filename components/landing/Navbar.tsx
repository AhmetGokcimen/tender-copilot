'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { USE_MOCK } from '@/lib/api';

export function Navbar() {
  const t = useTranslations('landing');
  return (
    <header className="sticky top-0 z-50 bg-navy text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-space-md px-margin lg:px-margin-desktop">
        <Link href="/" className="flex items-center gap-space-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-headline-sm text-headline-sm font-bold text-navy">
            O
          </span>
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight">Ofera</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-space-lg md:flex">
          <Link href="/#how" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('navHow')}
          </Link>
          <Link href="/#agents" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('navAgents')}
          </Link>
          <Link
            href="/#principles"
            className="font-body-md text-body-md text-white/80 hover:text-white"
          >
            {t('navPrinciples')}
          </Link>
          <Link href="/about" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('footerAbout')}
          </Link>
          <Link href="/pricing" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('footerPricing')}
          </Link>
          <Link href="/contact" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('footerContact')}
          </Link>
        </nav>
        {USE_MOCK ? (
          <Link
            href="/auth/signup"
            className="ml-auto inline-flex h-9 items-center rounded bg-white px-space-md font-label-md text-label-md font-semibold text-navy hover:bg-surface-container-high md:ml-0"
          >
            {t('openApp')}
          </Link>
        ) : (
          <Link
            href="/auth/signup"
            className="ml-auto inline-flex h-9 items-center rounded bg-white px-space-md font-label-md text-label-md font-semibold text-navy hover:bg-surface-container-high md:ml-0"
          >
            {t('demoLogin')}
          </Link>
        )}
      </div>
    </header>
  );
}
