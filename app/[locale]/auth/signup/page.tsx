import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { inviteValid } from '@/lib/invite';
import { SignupForm } from './SignupForm';

// The invite check reads the query string and a runtime env var.
export const dynamic = 'force-dynamic';

/**
 * Sign-ups are closed until launch. The form only renders for the owner's
 * private invite link (/auth/signup?invite=<code>); everyone else is sent
 * to the waitlist on the landing page. The check runs on the server, so
 * nothing about the code ships in the client bundle.
 */
export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { locale } = await params;
  const { invite } = await searchParams;
  setRequestLocale(locale);
  if (!inviteValid(invite)) redirect({ href: '/#waitlist', locale });
  return <SignupForm invite={invite as string} />;
}
