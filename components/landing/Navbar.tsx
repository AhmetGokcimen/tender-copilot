'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Logo } from '../brand/Logo';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

const LINK = 'text-[14px] text-ink-2 transition-colors hover:text-ink';

export function Navbar() {
  const t = useTranslations('landing');
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-8 px-4 md:px-8">
        <Link href="/" aria-label="Lichit home">
          <Logo />
        </Link>
        <nav className="ml-auto hidden items-center gap-7 md:flex">
          <Link href="/#how" className={LINK}>
            {t('navHow')}
          </Link>
          <Link href="/pricing" className={LINK}>
            {t('navPricing')}
          </Link>
          <Link href="/about" className={LINK}>
            {t('navAbout')}
          </Link>
          <Link href="/contact" className={LINK}>
            {t('navContact')}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4 md:ml-0 md:gap-5">
          <LanguageSwitcher />
          <Link href="/auth/login" className={`${LINK} hidden sm:inline`}>
            {t('signIn')}
          </Link>
          <Link
            href="/#waitlist"
            className="inline-flex h-10 items-center whitespace-nowrap rounded-pill bg-indigo px-[18px] text-[14px] font-medium text-on-indigo transition-colors hover:bg-indigo-deep"
          >
            {t('wlCta')}
          </Link>
        </div>
      </div>
    </header>
  );
}
