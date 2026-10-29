'use client';

import { useEffect, useRef } from 'react';

/**
 * Tilts up to 4deg toward the cursor and sets data-on while hovered, which
 * ticks in the `.tilt-check` rows (see globals.css). Static under reduced
 * motion and on touch screens.
 */
export function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Touch screens never hover, so show the finished card there too.
    if (reduce || !window.matchMedia('(hover: hover)').matches) {
      el.dataset.on = 'true';
      return;
    }
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
      el.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 8}deg`);
    };
    const onEnter = () => {
      el.dataset.on = 'true';
    };
    const onLeave = () => {
      el.dataset.on = 'false';
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <article ref={ref} data-on="false" className={`tilt-card ${className}`}>
      {children}
    </article>
  );
}
