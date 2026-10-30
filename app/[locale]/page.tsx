import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { faqPage, siteGraph } from '@/lib/schema';
import { pageMetadata, toLang } from '@/lib/seo';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { ProductBento } from '@/components/landing/ProductBento';
import { AudienceBlock } from '@/components/landing/AudienceBlock';
import { Faq } from '@/components/landing/Faq';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { Footer } from '@/components/landing/Footer';

/** Same order as the visible FAQ. */
const FAQ_ORDER = [1, 2, 6, 3, 4, 5] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '');
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const faq = FAQ_ORDER.map((n) => ({ q: t(`faq${n}Q`), a: t(`faq${n}A`) }));
  return (
    <div className="relative min-h-screen text-ink">
      <div id="page-top" aria-hidden className="pointer-events-none absolute left-0 top-0 h-2 w-px" />
      <JsonLd data={siteGraph(toLang(locale))} />
      <JsonLd data={faqPage(faq)} />
      <Navbar />
      <main className="relative z-10">
        <Hero />
        <ProductShowcase />
        <ProductBento />
        <AudienceBlock />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
