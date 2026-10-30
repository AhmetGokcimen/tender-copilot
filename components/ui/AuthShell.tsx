import { Link } from '@/i18n/routing';
import { Logo } from '../brand/Logo';
import { LanguageToggle } from '../i18n/LanguageToggle';

/** Centered auth card on paper with the Licits logo above it. */
export function AuthShell({
  title,
  subtitle,
  languages = true,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Show the EN | RO toggle in the corner (off on signup). */
  languages?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center bg-surface px-4 py-12 text-ink">
      {languages && <LanguageToggle className="absolute right-4 top-4 md:right-8 md:top-6" />}
      <Link href="/" aria-label="Licits home" className="mb-10">
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
