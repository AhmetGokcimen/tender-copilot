'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative layer behind the hero: a soft brand light and a faint grid
 * that glows around the pointer. Hidden from assistive tech.
 */
export function HeroBackdrop() {
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
    </div>
  );
}
