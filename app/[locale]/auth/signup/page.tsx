import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { SignupForm } from './SignupForm';

// The invite check reads the query string and a runtime env var.
export const dynamic = 'force-dynamic';

/**
 * Sign-ups are closed until launch. The form only renders for the owner's
 * private invite link (/auth/signup?invite=<SIGNUP_INVITE_CODE>); everyone
 * else is sent to the waitlist on the landing page. The code is a
 * server-only env var, so it never ships in the client bundle.
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
  const code = process.env.SIGNUP_INVITE_CODE;
  if (!code || invite !== code) redirect({ href: '/#waitlist', locale });
  return <SignupForm />;
}
