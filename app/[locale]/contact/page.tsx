import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import { webPage } from '@/lib/schema';
import { PAGE_META, pageMetadata, toLang } from '@/lib/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactForm } from '@/components/landing/ContactForm';
import { SitePage } from '@/components/landing/SitePage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/contact');
}

/** Contact form: subject and email on the left, the message on the right. */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const meta = PAGE_META['/contact'][toLang(locale)];
  return (
    <SitePage wide>
      <JsonLd data={webPage(toLang(locale), 'ContactPage', '/contact', meta.title, meta.description)} />
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="max-w-2xl text-[36px] font-light leading-[1.1] tracking-[-1.2px] text-ink md:text-[48px] md:leading-[52px] md:tracking-[-1.6px]">
            {t('title')}
          </h1>
          <p className="max-w-[60ch] text-[17px] leading-[27px] text-ink-2 md:text-[19px] md:leading-[29px]">{t('sub')}</p>
        </header>
        <ContactForm />
      </div>
    </SitePage>
  );
}
