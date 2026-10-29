import { Link } from '@/i18n/routing';
import { Logo } from '../brand/Logo';

/** Centered auth card on paper with the Lichit logo above it. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-surface px-4 py-12 text-ink">
      <Link href="/" aria-label="Lichit home" className="mb-10">
        <Logo />
      </Link>
      <div className="flex w-full max-w-md flex-col gap-6 rounded-card border border-line bg-raised p-6 shadow-lift-1 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-light leading-[34px] tracking-[-0.8px] text-ink">{title}</h1>
          {subtitle && <p className="text-[15px] leading-[23px] text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
