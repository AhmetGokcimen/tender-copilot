'use client';

import { useTranslations } from 'next-intl';
import { SignalStage } from './SignalStage';
import { TiltCard } from './TiltCard';
import { WaitlistForm } from './WaitlistForm';

/** Example tender at the end of the ribbon. Labelled "Example" on the card. */
function HeroCard() {
  const t = useTranslations('landing');
  const checks = [t('cardCheck1'), t('cardCheck2'), t('cardCheck3')];
  return (
    <TiltCard className="w-[300px] rounded-card border border-line bg-raised p-5 shadow-lift-2">
      <div className="flex justify-between font-mono text-[12px] font-medium text-muted">
        <span>CN1071284</span>
        <span>{t('cardExample')}</span>
      </div>
      <p className="mt-2.5 text-[17px] font-medium tracking-[-0.2px] text-ink">{t('cardTitle')}</p>
      <p className="mt-0.5 text-[13px] text-muted">{t('cardBuyer')}</p>
      <dl className="mt-3.5 flex gap-5 font-mono text-[13px] font-medium text-ink">
        <div>
          <dt className="mb-0.5 font-sans text-[11px] font-normal text-muted">{t('cardValue')}</dt>
          <dd>RON 412,000</dd>
        </div>
        <div>
          <dt className="mb-0.5 font-sans text-[11px] font-normal text-muted">{t('cardDeadline')}</dt>
          <dd>14 Nov</dd>
        </div>
      </dl>
      <span className="mt-3.5 inline-flex rounded-pill bg-eligible-bg px-2.5 py-1 text-[12px] font-semibold text-eligible">
        {t('cardEligible')}
      </span>
      <ul className="mt-3 grid gap-[7px]">
        {checks.map((c, i) => (
          <li
            key={c}
            className="tilt-check flex gap-2 text-[13px] text-ink-2"
            style={{ transitionDelay: `${i * 120}ms` }}
          >
            <span aria-hidden className="font-semibold text-eligible">
              ✓
            </span>
            {c}
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}

export function Hero() {
  const t = useTranslations('landing');
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100dvh-68px)] max-w-[1200px] grid-cols-1 items-center gap-10 px-4 py-14 md:px-8 lg:min-h-[620px] lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-6 lg:py-0">
        <div id="waitlist" className="relative z-10 scroll-mt-24">
          <h1 className="text-[40px] font-light leading-[1.08] tracking-[-1.4px] text-ink md:text-[56px] md:leading-[60px] md:tracking-[-2px]">
            {t('heroTitleA')} <span className="text-muted">{t('heroTitleB')}</span>
          </h1>
          <p className="mt-5 max-w-[470px] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">
            {t('heroSub')}
          </p>
          <div className="mt-8">
            <WaitlistForm source="hero" />
          </div>
        </div>
        <div className="hidden lg:block">
          <SignalStage>
            <HeroCard />
          </SignalStage>
        </div>
        <div className="flex justify-center lg:hidden">
          <HeroCard />
        </div>
      </div>
    </section>
  );
}
