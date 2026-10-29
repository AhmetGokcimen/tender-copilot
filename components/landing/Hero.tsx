'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { buttonClass } from '../ui/Button';
import { HeroRibbon } from './HeroRibbon';
import { Magnetic } from './MagneticButton';
import { TenderSieve } from './TenderSieve';

const STRIP = [
  { icon: 'account_balance', key: 'stripSource' },
  { icon: 'sync', key: 'stripSync' },
  { icon: 'document_scanner', key: 'stripOcr' },
  { icon: 'trophy', key: 'stripAwards' },
  { icon: 'description', key: 'stripDuae' },
] as const;

/**
 * The hero runs under the transparent navbar. The silk sits behind it and
 * continues beneath the strip at the bottom, which reads as the ribbon
 * passing under a layer, like paper on a desk.
 */
export function Hero() {
  const t = useTranslations('landing');
  return (
    <section id="top" className="relative -mt-[68px] overflow-hidden pt-[68px]">
      <HeroRibbon />
      {/* Container guide lines, drawn over the silk. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[1200px] -translate-x-1/2 border-x border-line/70 lg:block"
      />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-4 pb-16 pt-14 md:px-8 lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:py-20">
        <div>
          <p className="mb-5 inline-flex rounded-pill bg-indigo-soft px-3 py-1 text-[13px] font-medium text-indigo-text">
            {t('heroOffer')}
          </p>
          <h1 className="text-[40px] font-light leading-[1.08] tracking-[-1.4px] text-ink md:text-[56px] md:leading-[60px] md:tracking-[-2px]">
            {t('heroTitleA')} <span className="text-muted">{t('heroTitleB')}</span>
          </h1>
          <p className="mt-5 max-w-[470px] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">
            {t('heroSub')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Magnetic>
              <a href="#waitlist" className={buttonClass()}>
                {t('wlCta')}
              </a>
            </Magnetic>
            <a href="#product" className={buttonClass({ variant: 'link' })}>
              {t('seeHow')}
            </a>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <TenderSieve />
        </div>
      </div>
      {/* The layer the silk passes under. */}
      <div className="relative mx-auto max-w-[1200px] border-y border-line bg-surface">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-6 md:px-8 lg:grid-cols-5">
          {STRIP.map(({ icon, key }) => (
            <li key={key} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <Icon name={icon} className="text-muted" />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
