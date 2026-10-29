import { setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/landing/Navbar';
import { PageBackground } from '@/components/landing/PageBackground';
import { Hero } from '@/components/landing/Hero';
import { WaitlistSection } from '@/components/landing/WaitlistSection';
import { BeforeAfter } from '@/components/landing/BeforeAfter';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { HoursCalculator } from '@/components/landing/HoursCalculator';
import { Trust } from '@/components/landing/Trust';
import { Faq } from '@/components/landing/Faq';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { Footer } from '@/components/landing/Footer';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen text-ink">
      <PageBackground />
      <Navbar />
      <main className="relative z-10">
        <Hero />
        <WaitlistSection />
        <BeforeAfter />
        <HowItWorks />
        <HoursCalculator />
        <Trust />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
