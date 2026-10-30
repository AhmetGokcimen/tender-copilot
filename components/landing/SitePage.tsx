import { Navbar } from './Navbar';
import { Footer } from './Footer';

/** Shared shell for public subpages (About, Pricing, Contact, legal). */
export function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <Navbar />
      <main className="relative flex-1 overflow-hidden">
        <div className="relative mx-auto w-full max-w-3xl px-margin py-space-xl lg:px-margin-desktop lg:py-24">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
