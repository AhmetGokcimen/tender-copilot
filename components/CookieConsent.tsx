'use client';

import { useSyncExternalStore } from 'react';
import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { GA_ID, readConsent, subscribeConsent, writeConsent, type Consent } from '@/lib/consent';

const server = (): Consent => 'unknown';
const useConsent = () => useSyncExternalStore(subscribeConsent, readConsent, server);

/** Same look for both answers, so refusing is as easy as accepting. */
const BTN =
  'inline-flex h-10 flex-1 items-center justify-center rounded-pill border border-ink bg-raised px-5 text-[14px] font-medium text-ink transition-colors hover:bg-indigo-soft sm:flex-none';

/**
 * Cookie notice for Google Analytics, the only optional cookie on the site.
 * Analytics loads only after "Accept"; nothing is set before that. With no
 * GA_ID configured the component renders nothing.
 */
export function CookieConsent() {
  const t = useTranslations('consent');
  const consent = useConsent();
  if (!GA_ID) return null;
  return (
    <>
      {consent === 'granted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {consent === 'unknown' && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-[720px] rounded-card border border-line bg-raised p-4 shadow-lift-2 md:p-5"
        >
          <p className="text-[14px] font-medium text-ink">{t('title')}</p>
          <p className="mt-1 text-[13px] leading-[20px] text-ink-2">
            {t('text')}{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
              {t('more')}
            </Link>
          </p>
          <div className="mt-3 flex gap-3">
            <button type="button" className={BTN} onClick={() => writeConsent('denied')}>
              {t('reject')}
            </button>
            <button type="button" className={BTN} onClick={() => writeConsent('granted')}>
              {t('accept')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer link that lets visitors change their mind. Hidden when there is no optional cookie. */
export function CookieSettingsLink({ className }: { className?: string }) {
  const t = useTranslations('consent');
  if (!GA_ID) return null;
  return (
    <button type="button" className={className} onClick={() => writeConsent('unknown')}>
      {t('settings')}
    </button>
  );
}
