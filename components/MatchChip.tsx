'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

// Runs before paint on the client (no first-frame flash), silently on SSR.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Single-hue score chip: navy intensity encodes the band.
 * Color is reserved for critical states (eligibility verdicts, urgent
 * deadlines, expired documents) — see EligibilityChip.
 */
function tone(score: number | null): string {
  if (score === null) return 'border-outline-variant bg-transparent text-on-surface-variant';
  if (score >= 85) return 'border-indigo bg-indigo text-on-indigo';
  if (score >= 70) return 'border-indigo/30 bg-indigo-soft text-indigo-text';
  return 'border-outline-variant bg-transparent text-on-surface-variant';
}

export function MatchChip({ score, className }: { score: number | null; className?: string }) {
  const [shown, setShown] = useState<number | null>(score);
  const prevRef = useRef<number | null>(null);

  // Linear 600ms count-up on mount and whenever the score value changes.
  useIsoLayoutEffect(() => {
    if (prevRef.current === score) return;
    prevRef.current = score;
    if (
      score === null ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setShown(score);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const DURATION = 600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      setShown(Math.round(p * score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <span
      className={clsx(
        'tnum match-sonar relative inline-flex h-6 items-center rounded-full border px-space-xs font-code-sm text-code-sm font-bold',
        tone(score),
        className,
      )}
    >
      {shown === null ? '—' : `${shown}%`}
    </span>
  );
}
