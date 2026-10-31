import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { LegalDocument } from '@/components/landing/LegalDocument';
import { PRIVACY } from '@/lib/legal';
import { webPage } from '@/lib/schema';
import { pageMetadata, toLang } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/privacy');
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = toLang(locale);
  const doc = PRIVACY[lang];
  return (
    <>
      <JsonLd data={webPage(lang, 'WebPage', '/privacy', doc.title, doc.description)} />
      <LegalDocument doc={doc} lang={lang} />
    </>
  );
}
