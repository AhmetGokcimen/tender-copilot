'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { API_URL, USE_MOCK } from '@/lib/api';

export function Navbar() {
  const t = useTranslations('landing');
  return (
    <header className="sticky top-0 z-50 bg-navy text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-space-md px-margin lg:px-margin-desktop">
        <a href="#top" className="flex items-center gap-space-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-headline-sm text-headline-sm font-bold text-navy">
            O
          </span>
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight">Ofera</span>
        </a>
        <nav className="ml-auto hidden items-center gap-space-lg md:flex">
          <a href="#how" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('navHow')}
          </a>
          <a href="#agents" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('navAgents')}
          </a>
          <a href="#principles" className="font-body-md text-body-md text-white/80 hover:text-white">
            {t('navPrinciples')}
          </a>
        </nav>
        {USE_MOCK ? (
          <Link
            href="/app"
            className="ml-auto inline-flex h-9 items-center rounded bg-white px-space-md font-label-md text-label-md font-semibold text-navy hover:bg-surface-container-high md:ml-0"
          >
            {t('openApp')}
          </Link>
        ) : (
          <a
            href={`${API_URL}/auth/demo`}
            className="ml-auto inline-flex h-9 items-center rounded bg-white px-space-md font-label-md text-label-md font-semibold text-navy hover:bg-surface-container-high md:ml-0"
          >
            {t('demoLogin')}
          </a>
        )}
      </div>
    </header>
  );
}
