'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { MatchChip } from '../MatchChip';
import { EligibilityChip } from '../EligibilityChip';
import { AmbientOrbs } from './AmbientOrbs';

/**
 * HERO BACKGROUND SLOT — drop the generated background video URL here.
 * Full-bleed, covered, with a solid dark overlay for text readability.
 */
export const HERO_VIDEO_SRC: string | null = null;
export const HERO_POSTER_SRC: string | null = null;

function HeroMedia() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-navy" aria-hidden>
      {HERO_VIDEO_SRC ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_POSTER_SRC ?? undefined}
          className="h-full w-full object-cover"
        >
          <source src={HERO_VIDEO_SRC} type="video/mp4" />
        </video>
      ) : (
        <div className="dot-grid h-full w-full" />
      )}
      {/* Readability overlay (solid, no gradient wash) */}
      <div className="absolute inset-0 bg-navy/75" />
    </div>
  );
}

/**
 * Live miniature of the match-score → eligibility flow. MatchChip counts
 * up on mount (once); the verdict and reasons join in stages after it.
 * Reduced-motion users get the final state immediately.
 */
function HeroScoreCard() {
  const t = useTranslations('landing');
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage(2);
      return;
    }
    const timers = [
      window.setTimeout(() => setStage(1), 750),
      window.setTimeout(() => setStage(2), 1350),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <div
      data-assistant="hero-score-card"
      className="flex w-full max-w-sm flex-col gap-space-sm rounded-xl bg-white p-space-lg text-on-surface shadow-2xl"
    >
      <div className="flex items-center justify-between gap-space-sm">
        <span className="tnum font-code-sm text-code-sm text-on-surface-variant">CN1064821</span>
        <MatchChip score={92} />
      </div>
      <p className="font-headline-sm text-headline-sm font-semibold">{t('heroCardTitle')}</p>
      <div
        className={`transition-opacity duration-300 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}
      >
        {stage >= 1 && <EligibilityChip eligible={true} label={t('heroCardEligible')} />}
      </div>
      <ul
        className={`flex flex-col gap-1 transition-opacity duration-300 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`}
      >
        {[t('heroCardReason1'), t('heroCardReason2')].map((r) => (
          <li key={r} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Hero() {
  const t = useTranslations('landing');
  return (
    <section id="top" className="relative overflow-hidden text-white">
      <HeroMedia />
      <AmbientOrbs variant="hero" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-space-lg px-margin py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-margin-desktop lg:py-32">
        <div className="flex flex-col items-start gap-space-md">
          <h1
            data-assistant="hero-title"
            className="max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl"
          >
            {t('heroTitle')}
          </h1>
          <p className="max-w-xl font-body-lg text-body-lg text-white/80">{t('heroSub')}</p>
          <div className="mt-space-sm flex flex-wrap items-center gap-space-sm">
            <Link
              href="/auth/signup"
              data-assistant="hero-get-started"
              className="inline-flex h-11 items-center rounded-lg bg-white px-space-lg font-label-md text-label-md font-semibold text-navy hover:bg-surface-container-high"
            >
              {t('getStarted')}
            </Link>
            <a
              href="#how"
              className="inline-flex h-11 items-center rounded-lg border border-white/40 px-space-lg font-label-md text-label-md text-white hover:bg-white/10"
            >
              {t('seeHow')}
            </a>
          </div>
        </div>
        <div className="flex justify-start lg:justify-end">
          <HeroScoreCard />
        </div>
      </div>
    </section>
  );
}
