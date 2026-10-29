import { clsx } from 'clsx';

/**
 * Eligibility is a bid/no-bid decision — one of the few places allowed
 * full color. Uncertain stays neutral gray: undecided, not alarming.
 */
const TONES = {
  eligible: 'border-success/30 bg-success-bg text-success-deep',
  notEligible: 'border-danger/30 bg-danger-bg text-danger-deep',
  uncertain: 'border-outline-variant bg-transparent text-on-surface-variant',
} as const;

export function EligibilityChip({
  eligible,
  label,
  className,
}: {
  eligible: boolean | null;
  label: string;
  className?: string;
}) {
  const tone = eligible === true ? 'eligible' : eligible === false ? 'notEligible' : 'uncertain';
  return (
    <span
      className={clsx(
        'inline-flex h-6 items-center rounded-full border px-space-xs font-label-md text-label-md',
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
