'use client';

import { useEffect, useRef } from 'react';

/**
 * Pulls its single child up to ~6px toward the cursor and springs back on
 * leave, pointing at the one primary action. Off under reduced motion.
 */
export function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = ref.current!;
    const target = wrap.firstElementChild as HTMLElement | null;
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      const r = target.getBoundingClientRect();
      target.style.transition = 'background-color .15s';
      target.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px, ${(e.clientY - r.top - r.height / 2) * 0.2}px)`;
    };
    const onLeave = () => {
      target.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1), background-color .15s';
      target.style.transform = '';
    };
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);
    return () => {
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <span ref={ref} className="inline-flex">
      {children}
    </span>
  );
}
