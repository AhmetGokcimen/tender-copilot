'use client';

import { useId } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter, type Locale } from '@/i18n/routing';

/** United Kingdom flag, cropped to a circle. */
function FlagEn() {
  const clip = useId();
  return (
    <svg viewBox="0 0 60 60" className="h-full w-full" aria-hidden>
      <clipPath id={clip}>
        <circle cx="30" cy="30" r="30" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="60" height="60" fill="#012169" />
        <path d="M0 0L60 60M60 0L0 60" stroke="#fff" strokeWidth="12" />
        <path d="M0 0L60 60M60 0L0 60" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0V60M0 30H60" stroke="#fff" strokeWidth="20" />
        <path d="M30 0V60M0 30H60" stroke="#C8102E" strokeWidth="12" />
      </g>
    </svg>
  );
}

/** Romanian flag, cropped to a circle. */
function FlagRo() {
  const clip = useId();
  return (
    <svg viewBox="0 0 60 60" className="h-full w-full" aria-hidden>
      <clipPath id={clip}>
        <circle cx="30" cy="30" r="30" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="20" height="60" fill="#002B7F" />
        <rect x="20" width="20" height="60" fill="#FCD116" />
        <rect x="40" width="20" height="60" fill="#CE1126" />
      </g>
    </svg>
  );
}

const LOCALES: { code: Locale; label: string; Flag: () => React.ReactElement }[] = [
  { code: 'en', label: 'English', Flag: FlagEn },
  { code: 'ro', label: 'Română', Flag: FlagRo },
];

/** Round flag buttons that switch the locale and keep the current page. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div role="group" aria-label="Language" className={`flex items-center gap-1.5 ${className}`}>
      {LOCALES.map(({ code, label, Flag }) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => {
              if (active) return;
              router.replace(pathname, { locale: code, scroll: false });
            }}
            className={`h-7 w-7 overflow-hidden rounded-full transition-[opacity,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
              active
                ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--indigo)]'
                : 'opacity-60 shadow-[0_0_0_1px_var(--line-strong)] hover:opacity-100'
            }`}
          >
            <Flag />
          </button>
        );
      })}
    </div>
  );
}
