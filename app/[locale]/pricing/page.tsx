import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import { webPage } from '@/lib/schema';
import { PAGE_META, pageMetadata, toLang } from '@/lib/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { PricingPlans } from '@/components/landing/PricingPlans';
import { Faq } from '@/components/landing/Faq';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/pricing');
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pricing');
  const meta = PAGE_META['/pricing'][toLang(locale)];
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <JsonLd data={webPage(toLang(locale), 'WebPage', '/pricing', meta.title, meta.description)} />
      <Navbar />
      <main className="flex-1">
        <header className="mx-auto max-w-[1200px] px-4 pt-16 md:px-8 md:pt-24">
          <h1 className="max-w-3xl text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[52px] md:leading-[56px] md:tracking-[-1.8px]">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-[60ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">
            {t('sub')}
          </p>
        </header>
        <div className="-mt-10 md:-mt-14">
          <PricingPlans heading={false} />
        </div>
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
