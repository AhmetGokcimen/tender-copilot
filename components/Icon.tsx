import { clsx } from 'clsx';

const SIZES = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
} as const;

export function Icon({
  name,
  size = 'sm',
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span aria-hidden className={clsx('material-symbols-outlined leading-none', SIZES[size], className)}>
      {name}
    </span>
  );
}
