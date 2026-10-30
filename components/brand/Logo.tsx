/**
 * The Licits mark: a square-cut "L" on an ink tile, with a small indigo
 * signal square in the open corner. `onDark` inverts the tile for night
 * surfaces; the signal square stays indigo on both.
 */
export function LogoMark({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <rect width="48" height="48" rx="10" fill={onDark ? 'var(--on-night)' : 'var(--ink)'} />
      <path
        d="M15 11 V33 H33"
        fill="none"
        stroke={onDark ? 'var(--night)' : 'var(--surface)'}
        strokeWidth="5.5"
        strokeLinecap="square"
      />
      <rect x="29.5" y="11" width="7" height="7" fill="var(--indigo)" />
    </svg>
  );
}

/** The "Licits" wordmark in Geist SemiBold with tight tracking. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-semibold leading-none tracking-[-0.03em] ${className}`}>Licits</span>;
}

/** Mark plus wordmark. `onDark` switches both to their night variants. */
export function Logo({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark onDark={onDark} />
      <Wordmark className={`text-[21px] ${onDark ? 'text-on-night' : 'text-ink'}`} />
    </span>
  );
}
