import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { setRequestLocale } from 'next-intl/server';
import { LegalPage } from '@/components/landing/LegalPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/terms');
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage titleKey="termsTitle" />;
}
