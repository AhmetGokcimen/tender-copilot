'use client';

import { useTranslations } from 'next-intl';
import { buttonClass } from '../ui/Button';
import { Magnetic } from './MagneticButton';
import { SilkBackground } from './SilkBackground';
import { TenderSieve } from './TenderSieve';

export function Hero() {
  const t = useTranslations('landing');
  return (
    <section id="top" className="relative overflow-hidden">
      <SilkBackground />
      <div className="relative mx-auto grid min-h-[calc(100dvh-68px)] max-w-[1200px] grid-cols-1 items-center gap-12 px-4 py-14 md:px-8 lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:py-16">
        <div className="relative z-10">
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
            <a href="#how" className={buttonClass({ variant: 'link' })}>
              {t('seeHow')}
            </a>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <TenderSieve />
        </div>
      </div>
    </section>
  );
}
