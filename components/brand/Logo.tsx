/**
 * The Licits symbol: a tall "l" and a short "i" whose dot carries the brand
 * accent. Used where the name does not fit (app sidebar, favicon, email).
 */
export function LogoMark({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  const fill = onDark ? 'var(--on-night)' : 'var(--ink)';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <rect x="13" y="7" width="6" height="34" rx="3" fill={fill} />
      <rect x="25" y="20" width="6" height="21" rx="3" fill={fill} />
      <circle cx="28" cy="11" r="3.7" fill="var(--brand-dot)" />
    </svg>
  );
}

/** The "Licits" wordmark: the logo itself, set in the brand typeface. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-semibold leading-none tracking-[-0.035em] ${className}`}>Licits</span>;
}

/** The logo is the wordmark alone. `onDark` switches it to the night color. */
export function Logo({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return <Wordmark className={`text-[24px] ${onDark ? 'text-on-night' : 'text-ink'} ${className}`} />;
}
