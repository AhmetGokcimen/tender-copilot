import { Navbar } from './Navbar';
import { Footer } from './Footer';

/** Shared shell for public subpages (About, Pricing, Contact, legal). */
/** Shared shell for the marketing sub-pages. `wide` widens the column for side-by-side layouts. */
export function SitePage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <Navbar />
      <main className="relative flex-1 overflow-hidden">
        <div className={`relative mx-auto w-full ${wide ? 'max-w-[1040px]' : 'max-w-3xl'} px-margin py-space-xl lg:px-margin-desktop lg:py-24`}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
