import { useId } from 'react';

/**
 * The Lichit mark: a lowercase "l" stem (indigo to violet) and its amber
 * signal point. `tile` sets it on a night square for app icons.
 */
export function LogoMark({ size = 28, tile = false }: { size?: number; tile?: boolean }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--ribbon-1)" />
          <stop offset="1" stopColor="var(--ribbon-2)" />
        </linearGradient>
      </defs>
      {tile && <rect width="48" height="48" rx="12" fill="var(--night)" />}
      <rect x="15" y="7" width="8.5" height="34" rx="4.25" fill={`url(#${id})`} />
      <circle cx="33" cy="13" r="5.25" fill="var(--ribbon-4)" />
    </svg>
  );
}

/**
 * "lichit" with both i-dots in amber, echoing the mark's signal point.
 * Dotless i (U+0131) carries the stem; the dot is drawn on top. The visible
 * text is hidden from screen readers, which read the label instead.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  const i = (
    <span className="relative inline-block">
      {'ı'}
      <span className="absolute left-1/2 top-[0.03em] h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full bg-ribbon-4" />
    </span>
  );
  return (
    <span role="img" aria-label="Lichit" className={`font-medium leading-none tracking-[-0.035em] ${className}`}>
      <span aria-hidden>
        l{i}ch{i}t
      </span>
    </span>
  );
}

/** Mark plus wordmark. `onDark` switches the wordmark to light ink. */
export function Logo({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <Wordmark className={`text-[22px] ${onDark ? 'text-on-night' : 'text-ink'}`} />
    </span>
  );
}
