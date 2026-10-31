'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { buttonClass } from '../ui/Button';
import { HeroBackdrop } from './HeroBackdrop';
import { TenderMap } from './TenderMap';
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
 * First screen: headline on the left, the waitlist offer on the right and
 * the facts strip at the bottom, all within one viewport, over a faint dotted
 * map of Romania. The map is pinned while the hero scrolls away into an empty
 * band below; as the band comes up the map brightens into focus and example
 * notices start appearing city by city. Runs under the transparent navbar.
 */
export function Hero() {
  const t = useTranslations('landing');
  const bandRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(0);

  // Focus goes 0 -> 1 as the empty band rises from the bottom of the
  // viewport to 15% from the top.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = bandRef.current!.getBoundingClientRect().top;
      const vh = window.innerHeight;
      setFocus(Math.min(1, Math.max(0, (vh - top) / (vh * 0.85))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative -mt-[68px]">
      <div className="pointer-events-none absolute inset-0">
        <div className="sticky top-0 flex h-[400px] items-center justify-center overflow-hidden pt-[68px] md:h-[100dvh]">
          <TenderMap focus={focus} />
        </div>
      </div>
      <section
        id="top"
        className="relative overflow-hidden pt-[68px]"
        // The hero fades as it leaves, so the map has the stage to itself.
        style={{ opacity: 1 - Math.min(1, Math.max(0, (focus - 0.5) / 0.35)), pointerEvents: focus > 0.5 ? 'none' : undefined }}
      >
        <HeroBackdrop />
        <div className="relative z-10 flex min-h-[calc(100dvh-68px)] flex-col">
          <div className="relative mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 items-center gap-10 px-4 py-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 text-[14px] font-medium text-indigo-text">
                <Icon name="construction" size="sm" />
                {t('heroEyebrow')}
              </p>
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
          <div className="relative">
            <ul className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-3 px-4 py-5 md:px-8 lg:flex lg:justify-between">
              {STRIP.map(({ icon, key }) => (
                <li key={key} className="flex items-center gap-2 text-[13px] text-ink-2">
                  <Icon name={icon} size="sm" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {/* Empty on purpose: scrolling through it brings the map into focus. */}
      <div ref={bandRef} aria-hidden className="h-[40dvh] md:h-[120dvh]" />
    </div>
  );
}
