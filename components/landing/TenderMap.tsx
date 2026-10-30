'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Notice = {
  /** City position in % of the map box (from real coordinates). */
  x: number;
  y: number;
  city: string;
  title: { en: string; ro: string };
  value: number;
};

/** Example construction notices, one per city. Positions come from lat/lon. */
const NOTICES: Notice[] = [
  { x: 61.95, y: 83.14, city: 'București', title: { en: 'Metro station refit', ro: 'Modernizare stație metrou' }, value: 24600000 },
  { x: 35.41, y: 32.55, city: 'Cluj-Napoca', title: { en: 'School extension, 8 rooms', ro: 'Extindere școală, 8 săli' }, value: 6800000 },
  { x: 10.46, y: 54.6, city: 'Timișoara', title: { en: 'Apartment block insulation', ro: 'Reabilitare termică blocuri' }, value: 3900000 },
  { x: 77.71, y: 24.11, city: 'Iași', title: { en: 'Hospital wing renovation', ro: 'Renovare secție spital' }, value: 9400000 },
  { x: 88.91, y: 88.55, city: 'Constanța', title: { en: 'Seafront promenade works', ro: 'Lucrări faleză' }, value: 12100000 },
  { x: 56.66, y: 56.76, city: 'Brașov', title: { en: 'Sports hall construction', ro: 'Construire sală de sport' }, value: 7300000 },
  { x: 37.63, y: 85.52, city: 'Craiova', title: { en: 'Street lighting, LED', ro: 'Iluminat public LED' }, value: 2200000 },
  { x: 82.57, y: 61.3, city: 'Galați', title: { en: 'Water main replacement', ro: 'Înlocuire conductă apă' }, value: 5300000 },
  { x: 17.75, y: 26.06, city: 'Oradea', title: { en: 'Bike lanes, phase 2', ro: 'Piste de biciclete, etapa 2' }, value: 3200000 },
  { x: 41.33, y: 53.74, city: 'Sibiu', title: { en: 'School roof repair', ro: 'Reparații acoperiș școală' }, value: 640000 },
  { x: 11.3, y: 45.3, city: 'Arad', title: { en: 'Town hall facade works', ro: 'Lucrări fațadă primărie' }, value: 1100000 },
  { x: 70.51, y: 36.87, city: 'Bacău', title: { en: 'Kindergarten, 6 rooms', ro: 'Grădiniță cu 6 săli' }, value: 4700000 },
  { x: 63.64, y: 13.52, city: 'Suceava', title: { en: 'County road DJ 208 upgrade', ro: 'Modernizare DJ 208' }, value: 18600000 },
  { x: 48.94, y: 73.84, city: 'Pitești', title: { en: 'Sewer network extension', ro: 'Extindere canalizare' }, value: 4100000 },
  { x: 45.67, y: 37.52, city: 'Târgu Mureș', title: { en: 'Bridge consolidation', ro: 'Consolidare pod' }, value: 11300000 },
  { x: 69.56, y: 67.57, city: 'Buzău', title: { en: 'Social housing, 40 units', ro: 'Locuințe sociale, 40 unități' }, value: 15800000 },
  { x: 28.11, y: 51.79, city: 'Deva', title: { en: 'Stadium stands repair', ro: 'Reparații tribune stadion' }, value: 2900000 },
];

const VISIBLE = 4;
const STEP_MS = 1700;

/**
 * A dotted map of Romania (generated from Natural Earth borders) where
 * example construction notices pop up at their city and fade away.
 * Decorative; the caption says the notices are examples.
 */
export function TenderMap() {
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const t = useTranslations('landing');
  // Indices of the notices on screen, oldest first.
  const [shown, setShown] = useState<number[]>([0, 5, 9, 13]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Small screens have room for two cards at a time.
    const max = window.matchMedia('(min-width: 768px)').matches ? VISIBLE : 2;
    setShown((cur) => cur.slice(-max));
    let next = 1;
    const id = window.setInterval(() => {
      setShown((cur) => {
        // Skip notices already on screen.
        while (cur.includes(next % NOTICES.length)) next += 3;
        const add = next % NOTICES.length;
        next += 3;
        return [...cur.slice(cur.length >= max ? 1 : 0), add];
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  const fmt = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return (
    <figure className="relative mx-auto w-full max-w-[1100px] px-4 md:px-8">
      <div className="relative aspect-[1000/704]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/romania-dots.svg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full select-none"
          style={{
            maskImage: 'radial-gradient(75% 80% at 50% 50%, #000 60%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(75% 80% at 50% 50%, #000 60%, transparent 100%)',
          }}
          draggable={false}
        />
        <div aria-hidden className="absolute inset-0">
          {NOTICES.map((n, i) => {
            const on = shown.includes(i);
            // Cards near the right edge open to the left so they stay inside.
            const flip = n.x > 72;
            return (
              <div key={n.city} className="absolute" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
                <span
                  className={`absolute -left-[5px] -top-[5px] h-2.5 w-2.5 rounded-full bg-indigo ring-4 ring-surface transition-opacity duration-500 ${on ? 'opacity-100' : 'opacity-0'}`}
                />
                {on && <span className="map-ping absolute -left-[5px] -top-[5px] h-2.5 w-2.5 rounded-full bg-indigo" />}
                <div
                  className={`absolute bottom-3 w-[150px] rounded-[10px] border border-line bg-raised/95 px-2.5 py-1.5 md:w-[188px] md:px-3 md:py-2 shadow-lift-2 backdrop-blur-sm transition-all duration-500 ease-out ${
                    flip ? '-right-3' : '-left-3'
                  } ${on ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1.5 opacity-0'}`}
                >
                  <p className="truncate text-[11.5px] font-medium leading-[16px] text-ink md:text-[12.5px] md:leading-[17px]">{n.title[lang]}</p>
                  <p className="mt-0.5 flex justify-between gap-2 font-mono text-[10px] leading-[14px] text-muted md:text-[10.5px]">
                    <span className="truncate">{n.city}</span>
                    <span className="shrink-0 text-indigo-text">RON {fmt.format(n.value)}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[13px] text-muted">{t('mapNote')}</figcaption>
    </figure>
  );
}
