'use client';

import { useEffect, useRef } from 'react';

const THREADS = 72;
const SEGMENTS = 48;
const FRAME_MS = 33; // ~30fps is plenty for motion this slow

/** Small deterministic PRNG so the composition is the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Thread = {
  spread: number; // start offset from the convergence line, in hero heights
  width: number; // CSS px
  alpha: number;
  phase: number;
  freq: number;
  amp: number;
  speed: number;
};

function makeThreads(): Thread[] {
  const rnd = mulberry32(7);
  return Array.from({ length: THREADS }, (_, i) => {
    const u = i / (THREADS - 1) - 0.5; // -0.5 .. 0.5 across the fan
    const lead = rnd() < 0.12; // a few brighter threads carry the eye
    return {
      spread: u * 1.25 + (rnd() - 0.5) * 0.06,
      width: lead ? 1.6 + rnd() * 0.6 : 0.5 + rnd() * 0.9,
      alpha: lead ? 0.85 : 0.18 + rnd() * 0.45,
      phase: rnd() * Math.PI * 2,
      freq: 0.8 + rnd() * 1.4,
      amp: 0.03 + rnd() * 0.05,
      speed: 0.6 + rnd() * 0.8,
    };
  });
}

/**
 * Hero background: a fan of fine threads drifting like silk in a slow
 * current and converging into one point of light on the right, the brand
 * story of many notices narrowing to the one you can win. Drawn as real
 * strokes at device-pixel resolution so every line stays crisp. Pauses off
 * screen and in background tabs; reduced motion draws one still frame.
 */
export function ThreadsBackground({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const threads = makeThreads();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(document.documentElement);
    const stops = ['--ribbon-1', '--ribbon-2', '--ribbon-3', '--ribbon-4'].map((v) =>
      css.getPropertyValue(v).trim(),
    );

    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let last = 0;
    const start = performance.now() - 30_000;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };

    const draw = (now: number) => {
      if (!reduce && now - last < FRAME_MS) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = now;
      const t = (now - start) / 1000;
      const wide = W >= 1024;
      // Convergence point: right edge, a little above centre on desktop;
      // top-right corner on narrow screens.
      const cx = wide ? W * 0.97 : W * 1.02;
      const cy = wide ? H * 0.42 : H * 0.12;
      const x0 = wide ? W * 0.38 : -W * 0.1;
      const span = cx - x0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Threads fade in from their open end, keeping the headline side clear.
      const grad = ctx.createLinearGradient(x0, 0, cx, 0);
      grad.addColorStop(0, `${stops[0]}00`);
      grad.addColorStop(wide ? 0.4 : 0.15, stops[0]);
      grad.addColorStop(0.6, stops[1]);
      grad.addColorStop(0.75, stops[2]);
      grad.addColorStop(1, stops[3]);
      ctx.strokeStyle = grad;

      for (const th of threads) {
        ctx.beginPath();
        for (let s = 0; s <= SEGMENTS; s++) {
          const k = s / SEGMENTS; // 0 at the open end, 1 at the convergence point
          const x = x0 + span * k;
          // Ease the fan shut toward the point; threads stay loose far left.
          const close = 1 - Math.pow(k, 1.6);
          // A shared slow S-wave makes the threads move as one bundle.
          const flow = Math.sin(k * 2.3 + t * 0.045) * 0.07 + Math.sin(k * 4.1 - t * 0.03) * 0.025;
          const drift =
            flow +
            Math.sin(k * th.freq * 3.2 + th.phase + t * 0.09 * th.speed) * th.amp +
            Math.sin(k * 7.1 + th.phase * 1.7 - t * 0.05 * th.speed) * th.amp * 0.35;
          const y = cy + (th.spread * H * 0.62 + drift * H) * close * (wide ? 1 : 0.55);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = th.width;
        ctx.globalAlpha = th.alpha * (wide ? 1 : 0.32);
        ctx.stroke();
      }

      // The point of light where every thread meets.
      ctx.globalAlpha = 1;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46);
      glow.addColorStop(0, stops[3]);
      glow.addColorStop(0.25, `${stops[3]}99`);
      glow.addColorStop(1, `${stops[3]}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();

      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const resume = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce) resume();
    });
    io.observe(canvas);
    const onVisibility = () => {
      if (!document.hidden && !reduce) resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    resume();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
