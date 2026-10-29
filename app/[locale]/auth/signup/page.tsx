import { createHash, timingSafeEqual } from 'node:crypto';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { SignupForm } from './SignupForm';

// The invite check reads the query string and a runtime env var.
export const dynamic = 'force-dynamic';

/**
 * SHA-256 of the owner's private invite code. Only the hash is committed;
 * the code itself (24 random URL-safe characters) is not in the repo.
 */
const INVITE_SHA256 = '9d7906e504e4e0b7385a22efb7b4ce0190da3a2a2aeb4614443a98ca519310d8';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time check against SIGNUP_INVITE_CODE if set, else the committed hash. */
function inviteValid(invite: string | string[] | undefined): boolean {
  if (typeof invite !== 'string' || invite.length === 0) return false;
  const override = process.env.SIGNUP_INVITE_CODE;
  const expected = override ? sha256(override) : Buffer.from(INVITE_SHA256, 'hex');
  return timingSafeEqual(sha256(invite), expected);
}

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
  return <SignupForm />;
}
