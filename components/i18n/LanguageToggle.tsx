'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter, type Locale } from '@/i18n/routing';

const LOCALES: { code: Locale; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ro', label: 'RO', name: 'Română' },
];

/** Quiet EN | RO text switch for working screens, where flags would distract. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center rounded-pill border border-line bg-raised p-0.5 ${className}`}
    >
      {LOCALES.map((l) => {
        const active = l.code === locale;
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-label={l.name}
            aria-pressed={active}
            onClick={() => !active && router.replace(pathname, { locale: l.code })}
            className={`rounded-pill px-2.5 py-1 text-[12px] font-semibold tracking-wide transition-colors ${
              active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
