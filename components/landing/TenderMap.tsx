'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ROMANIA_GRID, ROMANIA_MASK } from '@/lib/romania-mask';
import { cityForCounty } from '@/lib/ro-cities';

/** A live SEAP construction notice placed on its county seat. */
type Notice = {
  id: string;
  /** City position in % of the map box. */
  x: number;
  y: number;
  city: string;
  title: string;
  value: number | null;
  url: string;
  publishedAt: number;
};

type ApiTender = {
  id: string;
  title: string;
  county: string;
  value: number | null;
  published_at: string;
  url: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
/** A notice leaves the map this long after SEAP published it. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** At most this many pins at once, so the map is never bare or crowded. */
const MAX_PINS = 12;
const REFRESH_MS = 10 * 60 * 1000;

/** How many cards show at once, and how often the next one appears. */
const VISIBLE_WIDE = 4;
const VISIBLE_NARROW = 2;
const STEP_MS = 3200;
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
 * brightens as it comes into focus, and only then do the live notices appear:
 * the newest SEAP construction notice of each big city, published in the last
 * 24 hours, at most one per city. Each one links to the official notice.
 */
export function TenderMap({ focus }: { focus: number }) {
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const t = useTranslations('landing');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const active = focus >= FOCUS_ON;
  const [shown, setShown] = useState<number[]>([]);
  const [fetched, setFetched] = useState<Notice[]>([]);
  const [now, setNow] = useState(() => Date.now());

  // Live notices from the public feed. A failure just leaves the map bare.
  useEffect(() => {
    let dead = false;
    const load = () =>
      fetch(`${API}/public/map-tenders`)
        .then((r) => (r.ok ? (r.json() as Promise<ApiTender[]>) : []))
        .then((rows) => {
          if (dead) return;
          const out: Notice[] = [];
          for (const t of rows) {
            const c = cityForCounty(t.county);
            if (c) {
              out.push({ id: t.id, x: c.x, y: c.y, city: c.city, title: t.title, value: t.value, url: t.url, publishedAt: Date.parse(t.published_at) });
            }
          }
          setFetched(out);
        })
        .catch(() => {});
    load();
    const id = window.setInterval(() => {
      setNow(Date.now());
      load();
    }, REFRESH_MS);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, []);

  // One pin per city, newest first, expired ones dropped.
  const notices = useMemo(() => {
    const seen = new Set<string>();
    return fetched
      .filter((n) => now - n.publishedAt < MAX_AGE_MS)
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .filter((n) => !seen.has(n.city) && seen.add(n.city))
      .slice(0, MAX_PINS);
  }, [fetched, now]);

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

  // Notices cycle only while the map is in focus. A pin shows up together with
  // its card and leaves with it.
  useEffect(() => {
    if (!active || notices.length === 0) {
      setShown([]);
      return;
    }
    const max = window.matchMedia('(min-width: 768px)').matches ? VISIBLE_WIDE : VISIBLE_NARROW;
    // West to east, then a long stride so consecutive cards land far apart.
    const pool = notices.map((_, i) => i).sort((a, b) => notices[a].x - notices[b].x);
    if (pool.length <= max || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(pool.slice(0, max));
      return;
    }
    const stride = Math.max(1, Math.round(pool.length * 0.4));
    let next = 0;
    const add = () =>
      setShown((cur) => {
        while (cur.includes(pool[next % pool.length])) next += 1;
        const i = pool[next % pool.length];
        next += stride;
        return [...cur.slice(cur.length >= max ? 1 : 0), i];
      });
    add();
    const id = window.setInterval(add, STEP_MS);
    return () => window.clearInterval(id);
  }, [active, notices]);

  const fmt = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return (
    <figure className="relative mx-auto w-[min(1100px,92vw,calc((100dvh-150px)*1.42))]">
      <div className="relative aspect-[1000/704]">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0">
          {notices.map((n, i) => {
            const on = shown.includes(i);
            // Cards near the right edge open to the left so they stay inside.
            const flip = n.x > 72;
            return (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={on ? 0 : -1}
                aria-label={`${n.title}, ${n.city}`}
                className={`group/pin absolute outline-none transition-opacity duration-500 hover:z-30 focus-visible:z-30 ${on ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                <span className="absolute -left-3.5 -top-3.5 h-7 w-7 rounded-full" />
                <span className="absolute -left-[5px] -top-[5px] h-2.5 w-2.5 rounded-full bg-indigo ring-4 ring-surface transition-transform group-hover/pin:scale-125 group-focus-visible/pin:ring-indigo-soft" />
                {on && <span className="map-ping absolute -left-[5px] -top-[5px] h-2.5 w-2.5 rounded-full bg-indigo" />}
                <div
                  className={`absolute bottom-3 w-[150px] rounded-[10px] border border-line bg-raised/95 px-2.5 py-1.5 shadow-lift-2 backdrop-blur-sm transition-all duration-500 ease-out md:w-[188px] md:px-3 md:py-2 ${
                    flip ? '-right-3' : '-left-3'
                  } ${on ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1.5 opacity-0'}`}
                >
                  <p className="truncate text-[11.5px] font-medium leading-[16px] text-ink md:text-[12.5px] md:leading-[17px]">
                    {n.title}
                  </p>
                  <p className="mt-0.5 flex justify-between gap-2 font-mono text-[10px] leading-[14px] text-muted md:text-[10.5px]">
                    <span className="truncate">{n.city}</span>
                    {n.value != null && <span className="shrink-0 text-indigo-text">RON {fmt.format(n.value)}</span>}
                  </p>
                </div>
              </a>
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
