import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'inverse' | 'link';
type Size = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo text-on-indigo hover:bg-indigo-deep',
  secondary: 'border border-line-strong bg-raised text-ink hover:border-ink',
  inverse: 'bg-raised text-ink hover:bg-sunk',
  link: 'text-indigo-text hover:underline hover:underline-offset-4',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-5 text-[15px]',
  sm: 'h-9 px-4 text-[13px]',
};

/**
 * Licits button classes. Every button is a pill; `primary` (indigo) is the
 * one filled action per view. Works on <button>, <a> and next-intl <Link>.
 */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return clsx(BASE, VARIANTS[variant], variant === 'link' ? 'text-[15px]' : SIZES[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
