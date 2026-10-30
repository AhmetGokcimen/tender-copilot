import { setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { ProductBento } from '@/components/landing/ProductBento';
import { Faq } from '@/components/landing/Faq';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { Footer } from '@/components/landing/Footer';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="relative min-h-screen text-ink">
      <div id="page-top" aria-hidden className="pointer-events-none absolute left-0 top-0 h-2 w-px" />
      <Navbar />
      <main className="relative z-10">
        <Hero />
        <ProductShowcase />
        <ProductBento />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
