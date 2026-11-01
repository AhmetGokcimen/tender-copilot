import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Geist_Mono, Schibsted_Grotesk } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { PAGE_META, SITE_URL, toLang } from '@/lib/seo';
import { QueryProvider } from '@/components/QueryProvider';
import { CookieConsent } from '@/components/CookieConsent';
import '../globals.css';

const sans = Schibsted_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fallback = PAGE_META[''][toLang(locale)];
  return {
    // Canonical origin for links and social previews (Vercel previews keep their own URL).
    metadataBase: new URL(SITE_URL),
    applicationName: 'Licits',
    // Pages set their own title, description, canonical and hreflang; this covers the app screens.
    title: fallback.title,
    description: fallback.description,
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Paths the locale middleware skips (anything with a dot, like /.env or
  // /package.json) land here with a made-up locale: answer 404, not the home page.
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${sans.variable} ${geistMono.variable} bg-surface font-sans text-on-surface antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            {children}
            <CookieConsent />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
