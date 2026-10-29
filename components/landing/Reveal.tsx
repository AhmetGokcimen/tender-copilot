'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/**
 * Calm fade-in on scroll. Default is opacity-only; `rise` adds a slight
 * upward settle for cards, `delayMs` staggers siblings. Reduced-motion
 * users get the final state with no transition (via useInView).
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
  rise = false,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  rise?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={clsx(
        rise ? 'transition-all duration-300 ease-out' : 'transition-opacity duration-500',
        inView ? 'translate-y-0 opacity-100' : rise ? 'translate-y-3 opacity-0' : 'opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
