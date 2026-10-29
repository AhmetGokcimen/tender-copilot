import { useId } from 'react';

/** The Lichit mark: four ribbon strands converging on the amber match node. */
export function LogoMark({ size = 28, tile = true }: { size?: number; tile?: boolean }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--ribbon-1)" />
          <stop offset=".45" stopColor="var(--ribbon-2)" />
          <stop offset=".8" stopColor="var(--ribbon-3)" />
          <stop offset="1" stopColor="var(--ribbon-4)" />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="16" fill="var(--night)" />}
      <g fill="none" stroke={`url(#${id})`} strokeLinecap="round">
        <path d="M12 18 C 26 18, 32 32, 44 32" strokeWidth="3" />
        <path d="M12 25 C 26 25, 32 32, 44 32" strokeWidth="2.4" opacity=".75" />
        <path d="M12 39 C 26 39, 32 32, 44 32" strokeWidth="2.4" opacity=".75" />
        <path d="M12 46 C 26 46, 32 32, 44 32" strokeWidth="3" />
      </g>
      <circle cx="48" cy="32" r="5" fill="var(--ribbon-4)" />
    </svg>
  );
}

/** Mark plus the lowercase wordmark. `onDark` uses the bare mark and light ink. */
export function Logo({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark tile={!onDark} />
      <span
        className={`text-[20px] font-semibold leading-none tracking-[-0.5px] ${onDark ? 'text-on-night' : 'text-ink'}`}
      >
        lichit
      </span>
    </span>
  );
}
