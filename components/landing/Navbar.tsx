'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Icon } from '../Icon';
import { Logo } from '../brand/Logo';
import { LanguageToggle } from '../i18n/LanguageToggle';

const LINK = 'text-[14px] text-ink-2 transition-colors hover:text-ink';
const CTA =
  'inline-flex h-10 items-center whitespace-nowrap rounded-pill bg-indigo px-[18px] text-[14px] font-medium text-on-indigo transition-colors hover:bg-indigo-deep';

export function Navbar() {
  const t = useTranslations('landing');
  // Transparent over the hero silk while the page sits at its very top
  // (only pages that render the #page-top sentinel); frosted otherwise.
  const [atTop, setAtTop] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById('page-top');
    if (!sentinel) return;
    const io = new IntersectionObserver(([e]) => setAtTop(e.isIntersecting));
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);
  // The mobile menu closes on Escape and when the window grows to desktop width.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => mq.matches && setOpen(false);
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onChange);
    };
  }, [open]);

  const close = () => setOpen(false);
  const links = [
    { href: '/#product', label: t('navHow') },
    { href: '/pricing', label: t('navPricing') },
    { href: '/resources', label: t('navResources') },
    { href: '/about', label: t('navAbout') },
    { href: '/contact', label: t('navContact') },
  ] as const;

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${
        atTop && !open ? 'border-transparent bg-transparent' : 'border-line bg-surface/90 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-8 px-4 md:px-8">
        <Link href="/" aria-label="Licits home" onClick={close}>
          <Logo className="!text-[32px]" />
        </Link>
        <nav className="ml-auto hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={LINK}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 md:ml-0 md:gap-5">
          <LanguageToggle />
          <Link href="/auth/login" className={`${LINK} hidden md:inline`}>
            {t('signIn')}
          </Link>
          <Link href="/#waitlist" className={`${CTA} hidden md:inline-flex`}>
            {t('wlCta')}
          </Link>
          <button
            type="button"
            aria-label={open ? t('menuClose') : t('menuOpen')}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-pill text-ink transition-colors hover:bg-indigo-soft md:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} size="lg" />
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Menu"
          className="border-t border-line bg-surface px-4 pb-5 pt-2 md:hidden"
        >
          <ul className="grid">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={close} className="flex h-12 items-center text-[17px] text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/auth/login" onClick={close} className="flex h-12 items-center text-[17px] text-ink-2">
                {t('signIn')}
              </Link>
            </li>
          </ul>
          <Link href="/#waitlist" onClick={close} className={`${CTA} mt-3 w-full justify-center`}>
            {t('wlCta')}
          </Link>
        </nav>
      )}
    </header>
  );
}
