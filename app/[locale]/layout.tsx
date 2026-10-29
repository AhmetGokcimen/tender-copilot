import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { QueryProvider } from '@/components/QueryProvider';
import { AssistantFab } from '@/components/assistant/AssistantFab';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { AssistantTooltip } from '@/components/assistant/AssistantTooltip';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: '500',
  display: 'swap',
});

export const metadata = {
  title: 'Ofera — SEAP Copilot',
  description: 'AI copilot for Romanian public procurement: find eligible tenders and draft winning offers.',
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
        className={`${inter.variable} ${jetbrainsMono.variable} bg-surface text-on-surface antialiased`}
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
