'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { buttonClass } from '../ui/Button';
import { HeroBackdrop } from './HeroBackdrop';
import { WaitlistForm } from './WaitlistForm';

const STRIP = [
  { icon: 'account_balance', key: 'stripSource' },
  { icon: 'sync', key: 'stripSync' },
  { icon: 'document_scanner', key: 'stripOcr' },
  { icon: 'trophy', key: 'stripAwards' },
  { icon: 'description', key: 'stripDuae' },
] as const;

const PERKS = ['wlPerk1', 'wlPerk2', 'wlPerk3'] as const;

/**
 * First screen: headline on the left, the waitlist offer on the right,
 * example tenders drifting behind, and the facts strip at the bottom,
 * all within one viewport. Runs under the transparent navbar.
 */
export function Hero() {
  const t = useTranslations('landing');
  return (
    <section id="top" className="relative -mt-[68px] flex min-h-[100dvh] flex-col overflow-hidden pt-[68px]">
      <HeroBackdrop />
      <div className="relative mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 items-center gap-10 px-4 py-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16">
        <div>
          <h1 className="text-[40px] font-light leading-[1.08] tracking-[-1.4px] text-ink md:text-[58px] md:leading-[62px] md:tracking-[-2.1px]">
            {t('heroTitleA')} <span className="text-muted">{t('heroTitleB')}</span>
          </h1>
          <p className="mt-5 max-w-[480px] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">
            {t('heroSub')}
          </p>
          <a href="#product" className={`mt-6 ${buttonClass({ variant: 'link' })} !px-0`}>
            {t('seeHow')}
            <Icon name="arrow_downward" size="sm" />
          </a>
        </div>
        <div
          id="waitlist"
          className="scroll-mt-24 rounded-card border border-line bg-raised/95 p-6 shadow-lift-2 backdrop-blur-sm md:p-8"
        >
          <p className="inline-flex rounded-pill bg-indigo-soft px-3 py-1 text-[13px] font-medium text-indigo-text">
            {t('heroOffer')}
          </p>
          <h2 className="mt-4 text-[26px] font-light leading-[32px] tracking-[-0.7px] text-ink">
            {t('wlTitleA')} <span className="text-indigo-text">{t('wlTitleB')}</span>
          </h2>
          <ul className="mt-4 grid gap-2">
            {PERKS.map((k) => (
              <li key={k} className="flex items-start gap-2.5 text-[14px] leading-[21px] text-ink-2">
                <Icon name="check" size="sm" className="mt-0.5 text-eligible" />
                {t(k)}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <WaitlistForm source="hero" />
          </div>
        </div>
      </div>
      <div className="relative border-t border-line/80 bg-surface/70 backdrop-blur-sm">
        <ul className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-3 px-4 py-5 md:px-8 lg:flex lg:justify-between">
          {STRIP.map(({ icon, key }) => (
            <li key={key} className="flex items-center gap-2 text-[13px] text-muted">
              <Icon name={icon} size="sm" />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
