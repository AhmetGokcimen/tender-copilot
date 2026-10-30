'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SITE } from '@/lib/site';
import { Logo } from '../brand/Logo';

const LINK = 'text-[14px] text-ink-2 transition-colors hover:text-ink';
const HEAD = 'text-[13px] font-semibold text-ink';

/** Brand marks, 20px, drawn in currentColor. No links yet, so they are plain icons. */
const SOCIALS = [
  {
    name: 'Instagram',
    path: 'M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-2.6a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z',
  },
  {
    name: 'LinkedIn',
    path: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6V21h-4v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z',
  },
  {
    name: 'X',
    path: 'M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.57l11.1 14.43Z',
  },
] as const;

export function Footer() {
  const t = useTranslations('landing');
  return (
    <footer className="relative z-10 border-t border-line bg-surface/85">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:px-8">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <Logo />
          <p className="max-w-xs text-[14px] leading-[21px] text-muted">{t('footerTag')}</p>
          <ul className="mt-1 flex items-center gap-2">
            {SOCIALS.map((so) => (
              <li key={so.name}>
                <span
                  role="img"
                  aria-label={so.name}
                  title={so.name}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-raised text-ink-2"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
                    <path d={so.path} />
                  </svg>
                </span>
              </li>
            ))}
          </ul>
          {SITE.email && (
            <a href={`mailto:${SITE.email}`} className={LINK}>
              {SITE.email}
            </a>
          )}
        </div>
        <nav aria-label={t('footerProduct')} className="flex flex-col gap-2.5">
          <span className={HEAD}>{t('footerProduct')}</span>
          <Link href="/#product" className={LINK}>
            {t('footerHow')}
          </Link>
          <Link href="/#faq" className={LINK}>
            {t('footerFaq')}
          </Link>
          <Link href="/pricing" className={LINK}>
            {t('footerPricing')}
          </Link>
          <Link href="/resources" className={LINK}>
            {t('footerResources')}
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
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-4 text-[12px] text-muted md:px-8">
          <span>{t('footerRights')}</span>
        </div>
      </div>
    </footer>
  );
}
