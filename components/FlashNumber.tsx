'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

/** Brief accent wash behind digits when the value changes (mount excluded). */
export function FlashNumber({ value, className }: { value: string; className?: string }) {
  const [flash, setFlash] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 650);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <span className={clsx(className, 'rounded transition-colors duration-500', flash && 'bg-navy/15')}>
      {value}
    </span>
  );
}
