'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Logo } from '../brand/Logo';
import { LanguageToggle } from '../i18n/LanguageToggle';

const LINK = 'text-[14px] text-ink-2 transition-colors hover:text-ink';

export function Navbar() {
  const t = useTranslations('landing');
  // Transparent over the hero silk while the page sits at its very top
  // (only pages that render the #page-top sentinel); frosted otherwise.
  const [atTop, setAtTop] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById('page-top');
    if (!sentinel) return;
    const io = new IntersectionObserver(([e]) => setAtTop(e.isIntersecting));
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);
  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${
        atTop ? 'border-transparent bg-transparent' : 'border-line bg-surface/80 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-8 px-4 md:px-8">
        <Link href="/" aria-label="Licits home">
          <Logo className="!text-[32px]" />
        </Link>
        <nav className="ml-auto hidden items-center gap-7 md:flex">
          <Link href="/#product" className={LINK}>
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
          <LanguageToggle />
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
