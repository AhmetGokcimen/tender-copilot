'use client';

import { useEffect, useId, useRef, useState } from 'react';
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

const FLAG_BTN =
  'h-7 w-7 shrink-0 overflow-hidden rounded-full transition-[opacity,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo';
const ACTIVE = 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--indigo)]';
const IDLE = 'opacity-60 shadow-[0_0_0_1px_var(--line-strong)] hover:opacity-100';

/**
 * Round flag buttons that switch the locale and keep the current page.
 * Desktop shows every flag; on phones only the active flag shows, and
 * tapping it opens the other languages underneath.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const go = (code: Locale) => {
    setOpen(false);
    if (code !== locale) router.replace(pathname, { locale: code, scroll: false });
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div role="group" aria-label="Language" className="hidden items-center gap-1.5 md:flex">
        {LOCALES.map(({ code, label, Flag }) => (
          <button
            key={code}
            type="button"
            lang={code}
            title={label}
            aria-label={label}
            aria-pressed={code === locale}
            onClick={() => go(code)}
            className={`${FLAG_BTN} ${code === locale ? ACTIVE : IDLE}`}
          >
            <Flag />
          </button>
        ))}
      </div>
      <div className="md:hidden">
        <button
          type="button"
          aria-label={`Language: ${current.label}`}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
          className={`${FLAG_BTN} ${ACTIVE} block`}
        >
          <current.Flag />
        </button>
        {open && (
          <div className="absolute left-1/2 top-full z-50 mt-2 flex -translate-x-1/2 flex-col gap-2 rounded-pill border border-line bg-raised p-1.5 shadow-lift-2">
            {LOCALES.filter((l) => l.code !== locale).map(({ code, label, Flag }) => (
              <button
                key={code}
                type="button"
                lang={code}
                title={label}
                aria-label={label}
                onClick={() => go(code)}
                className={`${FLAG_BTN} shadow-[0_0_0_1px_var(--line-strong)]`}
              >
                <Flag />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
