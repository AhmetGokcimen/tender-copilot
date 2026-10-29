'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/** First pass with Lichit, including the buyer's past awards: about 10 minutes. */
const LICHIT_HOURS = 1 / 6;
const WEEKS_PER_MONTH = 4.3;

const hoursBack = (tenders: number, manual: number) =>
  Math.max(0, Math.round(tenders * WEEKS_PER_MONTH * (manual - LICHIT_HOURS)));

function pct(v: number, min: number, max: number) {
  return { '--p': `${((v - min) / (max - min)) * 100}%` } as React.CSSProperties;
}

/** The visitor's own workload in, hours per month back out. */
export function HoursCalculator() {
  const t = useTranslations('landing');
  const [tenders, setTenders] = useState(8);
  const [manual, setManual] = useState(2);
  const outRef = useRef<HTMLSpanElement>(null);
  const shown = useRef(hoursBack(8, 2));
  const target = hoursBack(tenders, manual);

  // Count to the new value by writing to the DOM, not re-rendering per frame.
  useEffect(() => {
    const el = outRef.current!;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown.current = target;
      el.textContent = String(target);
      return;
    }
    let raf = 0;
    const step = () => {
      shown.current += (target - shown.current) * 0.18;
      if (Math.abs(target - shown.current) < 0.5) shown.current = target;
      el.textContent = String(Math.round(shown.current));
      if (shown.current !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <section className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-12">
      <div>
        <h2 className="text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
          {t('hoursTitle')}
        </h2>
        <div className="mt-7">
          <label htmlFor="calc-tenders" className="mb-2.5 flex justify-between text-[14px] text-ink-2">
            {t('hoursTenders')}
            <output className="font-mono font-medium text-ink">{tenders}</output>
          </label>
          <input
            id="calc-tenders"
            type="range"
            min={1}
            max={40}
            value={tenders}
            onChange={(e) => setTenders(Number(e.target.value))}
            className="range"
            style={pct(tenders, 1, 40)}
          />
        </div>
        <div className="mt-7">
          <label htmlFor="calc-manual" className="mb-2.5 flex justify-between text-[14px] text-ink-2">
            {t('hoursManual')}
            <output className="font-mono font-medium text-ink">{manual.toFixed(1)} h</output>
          </label>
          <input
            id="calc-manual"
            type="range"
            min={0.5}
            max={6}
            step={0.5}
            value={manual}
            onChange={(e) => setManual(Number(e.target.value))}
            className="range"
            style={pct(manual, 0.5, 6)}
          />
        </div>
      </div>
      <div aria-live="polite" className="rounded-card border border-line bg-raised p-8">
        <p className="font-mono text-[56px] leading-none tracking-[-2px] text-ink md:text-[64px]">
          <span ref={outRef}>{hoursBack(8, 2)}</span>
          <span className="text-[24px] tracking-normal text-muted"> {t('hoursUnit')}</span>
        </p>
        <p className="mt-2 text-[15px] text-ink-2">{t('hoursCaption')}</p>
        <p className="mt-5 text-[12px] leading-[18px] text-muted">{t('hoursNote')}</p>
      </div>
    </section>
  );
}
