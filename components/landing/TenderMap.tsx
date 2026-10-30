'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ROMANIA_GRID, ROMANIA_MASK } from '@/lib/romania-mask';

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
  {
    x: 61.95,
    y: 83.14,
    city: 'București',
    title: { en: 'Metro station refit', ro: 'Modernizare stație metrou' },
    value: 24600000,
  },
  {
    x: 35.41,
    y: 32.55,
    city: 'Cluj-Napoca',
    title: { en: 'School extension, 8 rooms', ro: 'Extindere școală, 8 săli' },
    value: 6800000,
  },
  {
    x: 10.46,
    y: 54.6,
    city: 'Timișoara',
    title: { en: 'Apartment block insulation', ro: 'Reabilitare termică blocuri' },
    value: 3900000,
  },
  {
    x: 77.71,
    y: 24.11,
    city: 'Iași',
    title: { en: 'Hospital wing renovation', ro: 'Renovare secție spital' },
    value: 9400000,
  },
  {
    x: 88.91,
    y: 88.55,
    city: 'Constanța',
    title: { en: 'Seafront promenade works', ro: 'Lucrări faleză' },
    value: 12100000,
  },
  {
    x: 56.66,
    y: 56.76,
    city: 'Brașov',
    title: { en: 'Sports hall construction', ro: 'Construire sală de sport' },
    value: 7300000,
  },
  {
    x: 37.63,
    y: 85.52,
    city: 'Craiova',
    title: { en: 'Street lighting, LED', ro: 'Iluminat public LED' },
    value: 2200000,
  },
  {
    x: 82.57,
    y: 61.3,
    city: 'Galați',
    title: { en: 'Water main replacement', ro: 'Înlocuire conductă apă' },
    value: 5300000,
  },
  {
    x: 17.75,
    y: 26.06,
    city: 'Oradea',
    title: { en: 'Bike lanes, phase 2', ro: 'Piste de biciclete, etapa 2' },
    value: 3200000,
  },
  {
    x: 41.33,
    y: 53.74,
    city: 'Sibiu',
    title: { en: 'School roof repair', ro: 'Reparații acoperiș școală' },
    value: 640000,
  },
  {
    x: 11.3,
    y: 45.3,
    city: 'Arad',
    title: { en: 'Town hall facade works', ro: 'Lucrări fațadă primărie' },
    value: 1100000,
  },
  {
    x: 70.51,
    y: 36.87,
    city: 'Bacău',
    title: { en: 'Kindergarten, 6 rooms', ro: 'Grădiniță cu 6 săli' },
    value: 4700000,
  },
  {
    x: 63.64,
    y: 13.52,
    city: 'Suceava',
    title: { en: 'County road DJ 208 upgrade', ro: 'Modernizare DJ 208' },
    value: 18600000,
  },
  {
    x: 48.94,
    y: 73.84,
    city: 'Pitești',
    title: { en: 'Sewer network extension', ro: 'Extindere canalizare' },
    value: 4100000,
  },
  {
    x: 45.67,
    y: 37.52,
    city: 'Târgu Mureș',
    title: { en: 'Bridge consolidation', ro: 'Consolidare pod' },
    value: 11300000,
  },
  {
    x: 69.56,
    y: 67.57,
    city: 'Buzău',
    title: { en: 'Social housing, 40 units', ro: 'Locuințe sociale, 40 unități' },
    value: 15800000,
  },
  {
    x: 25.58,
    y: 78.82,
    city: 'Drobeta-Turnu Severin',
    title: { en: 'Danube quay repair', ro: 'Reparații cheu Dunăre' },
    value: 8200000,
  },
  {
    x: 43.7,
    y: 83.1,
    city: 'Slatina',
    title: { en: 'Clinic energy retrofit', ro: 'Eficientizare energetică policlinică' },
    value: 3600000,
  },
  {
    x: 53.8,
    y: 93.1,
    city: 'Alexandria',
    title: { en: 'Rural roads, 14 km', ro: 'Drumuri comunale, 14 km' },
    value: 9900000,
  },
  { x: 75.0, y: 88.1, city: 'Călărași', title: { en: 'High school gym', ro: 'Sală de sport liceu' }, value: 5100000 },
  {
    x: 28.11,
    y: 51.79,
    city: 'Deva',
    title: { en: 'Stadium stands repair', ro: 'Reparații tribune stadion' },
    value: 2900000,
  },
];

/** How many notices show at once, and how often a new one appears. */
const VISIBLE_WIDE = 4;
const VISIBLE_NARROW = 2;
const STEP_MS = 1600;
/** Notices start once the map is this much in focus (0..1). */
const FOCUS_ON = 0.8;

/** Brand dot colors across the map, west (forest) to east (gold). */
const STOPS: [number, number, number][] = [
  [15, 92, 69],
  [79, 154, 118],
  [212, 167, 44],
];
const BUCKETS = 10;

type Dot = { x: number; y: number; r: number; o: number; c: number; tw: number; ph: number; sp: number };

/** Decodes the bit grid into dots with stable pseudo-random size and shimmer. */
function buildDots(): Dot[] {
  const { cols, rows, step } = ROMANIA_GRID;
  const bytes = Uint8Array.from(atob(ROMANIA_MASK), (ch) => ch.charCodeAt(0));
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dots: Dot[] = [];
  for (let i = 0; i < cols * rows; i++) {
    if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
    const x = step / 2 + (i % cols) * step;
    const y = step / 2 + Math.floor(i / cols) * step;
    const t = Math.min(1, (x / 1000) * 0.75 + (y / 704) * 0.35);
    dots.push({
      x,
      y,
      r: 1.2 + rnd() * 1.5,
      o: 0.35 + rnd() * 0.55,
      c: Math.min(BUCKETS - 1, Math.floor(t * BUCKETS)),
      // About one dot in three shimmers, each at its own pace.
      tw: rnd() < 0.34 ? 1 : 0,
      ph: rnd() * Math.PI * 2,
      sp: 0.6 + rnd() * 1.4,
    });
  }
  return dots;
}

function bucketColor(b: number) {
  const t = (b + 0.5) / BUCKETS;
  const [a, z, k] = t < 0.6 ? [STOPS[0], STOPS[1], t / 0.6] : [STOPS[1], STOPS[2], (t - 0.6) / 0.4];
  return `rgb(${a.map((v, i) => Math.round(v + (z[i] - v) * k)).join(',')})`;
}

/**
 * A dotted map of Romania drawn on canvas (from Natural Earth borders). Its
 * dots shimmer softly. `focus` (0..1) comes from the scroll position: the map
 * brightens as it comes into focus, and only then do example construction
 * notices start popping up at their cities.
 */
export function TenderMap({ focus }: { focus: number }) {
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const t = useTranslations('landing');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const active = focus >= FOCUS_ON;
  const [shown, setShown] = useState<number[]>([]);

  // Draw loop: static dots are cached once, shimmering ones redraw ~24 fps
  // while the map is on screen.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dots = buildDots();
    const colors = Array.from({ length: BUCKETS }, (_, b) => bucketColor(b));
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = document.createElement('canvas');
    let scale = 1;
    let raf = 0;
    let last = 0;
    let visible = true;

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      scale = (w / 1000) * dpr;
      canvas.width = base.width = Math.round(w * dpr);
      canvas.height = base.height = Math.round(canvas.clientHeight * dpr);
      const b = base.getContext('2d')!;
      for (const d of dots) {
        if (d.tw && !still) continue;
        b.globalAlpha = d.o;
        b.fillStyle = colors[d.c];
        b.beginPath();
        b.arc(d.x * scale, d.y * scale, d.r * scale, 0, Math.PI * 2);
        b.fill();
      }
    };

    const draw = (now: number) => {
      const f = focusRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Faint behind the hero, full strength once in focus.
      const level = 0.3 + 0.7 * f;
      ctx.globalAlpha = level;
      ctx.drawImage(base, 0, 0);
      if (still) return;
      const s = now / 1000;
      for (const d of dots) {
        if (!d.tw) continue;
        const pulse = 0.5 + 0.5 * Math.sin(s * d.sp + d.ph);
        ctx.globalAlpha = level * d.o * (0.25 + 0.75 * pulse);
        ctx.fillStyle = colors[d.c];
        ctx.beginPath();
        ctx.arc(d.x * scale, d.y * scale, d.r * scale * (0.85 + 0.25 * pulse), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < 42) return;
      last = now;
      draw(now);
    };

    layout();
    draw(performance.now());
    const ro = new ResizeObserver(() => {
      layout();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    if (!still) raf = requestAnimationFrame(loop);
    else {
      // Without the loop, redraw when the focus changes.
      const onScroll = () => draw(0);
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', onScroll);
        ro.disconnect();
        io.disconnect();
      };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  // Notices cycle only while the map is in focus.
  useEffect(() => {
    if (!active) {
      setShown([]);
      return;
    }
    const max = window.matchMedia('(min-width: 768px)').matches ? VISIBLE_WIDE : VISIBLE_NARROW;
    // West to east, stepping by 5 so consecutive notices land far apart.
    const pool = NOTICES.map((_, i) => i).sort((a, b) => NOTICES[a].x - NOTICES[b].x);
    let next = 0;
    const add = () =>
      setShown((cur) => {
        while (cur.includes(pool[next % pool.length])) next += 1;
        const i = pool[next % pool.length];
        next += 5;
        return [...cur.slice(cur.length >= max ? 1 : 0), i];
      });
    add();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let k = 1; k < max; k++) add();
      return;
    }
    const id = window.setInterval(add, STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  const fmt = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return (
    <figure className="relative mx-auto w-[min(1100px,92vw,calc((100dvh-150px)*1.42))]">
      <div className="relative aspect-[1000/704]">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
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
                  className={`absolute bottom-3 w-[150px] rounded-[10px] border border-line bg-raised/95 px-2.5 py-1.5 shadow-lift-2 backdrop-blur-sm transition-all duration-500 ease-out md:w-[188px] md:px-3 md:py-2 ${
                    flip ? '-right-3' : '-left-3'
                  } ${on ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1.5 opacity-0'}`}
                >
                  <p className="truncate text-[11.5px] font-medium leading-[16px] text-ink md:text-[12.5px] md:leading-[17px]">
                    {n.title[lang]}
                  </p>
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
      <figcaption
        className="mt-3 text-center text-[13px] text-muted transition-opacity duration-500"
        style={{ opacity: Math.max(0, (focus - 0.4) / 0.6) }}
      >
        {t('mapNote')}
      </figcaption>
    </figure>
  );
}
