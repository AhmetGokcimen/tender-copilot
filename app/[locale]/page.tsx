import { setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { AgentsSection, Principles, ProblemSolution } from '@/components/landing/Sections';
import { Footer } from '@/components/landing/Footer';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main>
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <AgentsSection />
        <Principles />
      </main>
      <Footer />
    </div>
  );
}
