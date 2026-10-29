import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { QueryProvider } from '@/components/QueryProvider';
import { AssistantFab } from '@/components/assistant/AssistantFab';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { AssistantTooltip } from '@/components/assistant/AssistantTooltip';
import '../globals.css';

const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'Lichit | Win the public tenders you have been missing',
  description:
    'Lichit reads every SEAP notice, shows which tenders your company can win, and drafts the offer with you.',
};

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
        className={`${geist.variable} ${geistMono.variable} bg-surface font-sans text-on-surface antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            {children}
            <AssistantFab />
            <AssistantPanel />
            <AssistantTooltip />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
