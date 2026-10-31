import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { LegalDocument } from '@/components/landing/LegalDocument';
import { TERMS } from '@/lib/legal';
import { webPage } from '@/lib/schema';
import { pageMetadata, toLang } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/terms');
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = toLang(locale);
  const doc = TERMS[lang];
  return (
    <>
      <JsonLd data={webPage(lang, 'WebPage', '/terms', doc.title, doc.description)} />
      <LegalDocument doc={doc} lang={lang} />
    </>
  );
}
