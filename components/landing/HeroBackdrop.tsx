'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';

type Tone = 'indigo' | 'eligible' | 'coral' | 'amber' | 'neutral';

type Chip = {
  title: { en: string; ro: string };
  city: string;
  value: number;
  tone: Tone;
  /** Position in % of the hero, width in px, depth 0 (near) .. 2 (far). */
  x: number;
  y: number;
  w: number;
  depth: 0 | 1 | 2;
};

/**
 * Example notices scattered around the hero, Daybridge-style. Positions keep
 * clear of the navbar band, the headline and the waitlist card.
 */
const CHIPS: Chip[] = [
  { title: { en: 'Apartment block insulation', ro: 'Reabilitare termică bloc' }, city: 'Brașov', value: 3800000, tone: 'eligible', x: 3, y: 12, w: 178, depth: 0 },
  { title: { en: 'County road DJ 107 upgrade', ro: 'Modernizare DJ 107' }, city: 'Alba', value: 18600000, tone: 'neutral', x: 23, y: 14, w: 168, depth: 2 },
  { title: { en: 'New kindergarten, 6 rooms', ro: 'Grădiniță cu 6 săli' }, city: 'Sânpetru', value: 7200000, tone: 'indigo', x: 43, y: 11, w: 172, depth: 1 },
  { title: { en: 'Sewer network extension', ro: 'Extindere canalizare' }, city: 'Hărman', value: 4100000, tone: 'eligible', x: 63, y: 13, w: 170, depth: 2 },
  { title: { en: 'School roof repair', ro: 'Reparații acoperiș școală' }, city: 'Sibiu', value: 640000, tone: 'amber', x: 84, y: 12, w: 168, depth: 0 },
  { title: { en: 'Bridge consolidation', ro: 'Consolidare pod' }, city: 'Făgăraș', value: 11300000, tone: 'coral', x: 93, y: 40, w: 160, depth: 1 },
  { title: { en: 'Hospital wing refit', ro: 'Modernizare secție spital' }, city: 'Iași', value: 9400000, tone: 'indigo', x: 92, y: 63, w: 172, depth: 2 },
  { title: { en: 'Street lighting, LED', ro: 'Iluminat public LED' }, city: 'Cluj', value: 2200000, tone: 'eligible', x: 66, y: 84, w: 160, depth: 1 },
  { title: { en: 'Sports hall construction', ro: 'Construire sală de sport' }, city: 'Oradea', value: 6900000, tone: 'neutral', x: 45, y: 87, w: 176, depth: 2 },
  { title: { en: 'Water main replacement', ro: 'Înlocuire conductă apă' }, city: 'Timișoara', value: 5300000, tone: 'amber', x: 23, y: 84, w: 170, depth: 0 },
  { title: { en: 'Town hall facade works', ro: 'Lucrări fațadă primărie' }, city: 'Arad', value: 1100000, tone: 'coral', x: 3, y: 78, w: 162, depth: 1 },
  { title: { en: 'Bike lanes, phase 2', ro: 'Piste de biciclete, etapa 2' }, city: 'Constanța', value: 3200000, tone: 'indigo', x: -6, y: 46, w: 164, depth: 2 },
];

const TONES: Record<Tone, string> = {
  indigo: 'border-indigo/20 bg-indigo-soft/90 text-indigo-deep',
  eligible: 'border-[#c8ecda] bg-[#e5f6ee]/90 text-[#067a52]',
  coral: 'border-[#ffd6cf] bg-[#fff0ec]/90 text-[#b4412f]',
  amber: 'border-[#ffe3b0] bg-[#fff6e3]/90 text-[#94600a]',
  neutral: 'border-line bg-raised/90 text-ink-2',
};

const DEPTH = ['opacity-95', 'opacity-70 blur-[0.6px]', 'opacity-45 blur-[1.4px]'];

/**
 * Decorative layer: small example tender cards around the edges of the
 * hero, floating very slowly. Far cards are smaller, softer and fainter,
 * which gives depth. Hidden from assistive tech.
 */
export function HeroBackdrop() {
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const ref = useRef<HTMLDivElement>(null);

  // The grid lights up softly around the pointer as it moves over the hero.
  useEffect(() => {
    const el = ref.current!;
    const host = el.parentElement;
    if (!host || !window.matchMedia('(hover: hover)').matches) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.dataset.glow = 'on';
    };
    const onLeave = () => {
      el.dataset.glow = 'off';
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, []);
  const fmt = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return (
    <div ref={ref} aria-hidden data-glow="off" className="group/glow pointer-events-none absolute inset-0 overflow-hidden">
      {/* Soft brand light and a faint grid, like paper under the cards. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,rgb(var(--ribbon-1-rgb)/0.10),transparent_70%),radial-gradient(50%_45%_at_90%_100%,rgb(var(--ribbon-4-rgb)/0.12),transparent_70%),radial-gradient(40%_40%_at_100%_10%,rgb(var(--ribbon-2-rgb)/0.10),transparent_70%)]" />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse at center, #000 25%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 25%, transparent 75%)',
        }}
      />
      {/* Indigo copy of the grid, revealed only in a small circle around the pointer. */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-data-[glow=on]/glow:opacity-100"
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--indigo-rgb) / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--indigo-rgb) / 0.55) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(170px circle at var(--mx, -999px) var(--my, -999px), #000, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(170px circle at var(--mx, -999px) var(--my, -999px), #000, transparent 75%)',
        }}
      />
      {CHIPS.map((c, i) => (
        <div
          key={c.title.en}
          className={`hero-chip absolute hidden rounded-[10px] border px-3 py-2 shadow-lift-1 md:block ${TONES[c.tone]} ${DEPTH[c.depth]} ${
            i % 3 === 0 ? 'max-lg:hidden' : ''
          }`}
          style={
            {
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: c.w - c.depth * 12,
              '--float-dur': `${11 + (i % 5) * 2.3}s`,
              '--float-delay': `${-(i * 1.7)}s`,
            } as React.CSSProperties
          }
        >
          <p className="truncate text-[12px] font-medium leading-[16px]">{c.title[lang]}</p>
          <p className="mt-0.5 flex justify-between gap-2 font-mono text-[10.5px] leading-[14px] opacity-80">
            <span className="truncate">{c.city}</span>
            <span className="shrink-0">RON {fmt.format(c.value)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
