'use server';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase-public';

export type ContactResult = { status: 'ok' | 'invalid' | 'error' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Contact form: saves the message to the Supabase `contact_message` table
 * (anon INSERT only, like the waitlist) together with `mail_status`, the
 * result of the email the browser sent through FormSubmit (see
 * lib/contact-config.ts). Success means the message is saved, or that the
 * browser already emailed it, so nothing is lost when one path is down.
 * The hidden `company_website` field is a honeypot: bots that fill it get
 * a fake success and nothing is stored.
 */
export async function sendContact(formData: FormData): Promise<ContactResult> {
  if (String(formData.get('company_website') ?? '').trim()) return { status: 'ok' };

  const subject = String(formData.get('subject') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'en').slice(0, 8);
  const mailStatus = String(formData.get('mail_status') ?? '').slice(0, 400);
  if (
    !subject ||
    subject.length > 150 ||
    !EMAIL.test(email) ||
    email.length > 254 ||
    !message ||
    message.length > 5000
  ) {
    return { status: 'invalid' };
  }

  const saved = await fetch(`${SUPABASE_URL}/rest/v1/contact_message`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ subject, email, message, locale, mail_status: mailStatus || null }),
    cache: 'no-store',
  })
    .then((r) => r.ok)
    .catch(() => false);
  if (!saved) console.error('contact: could not save the message');

  return saved || mailStatus.startsWith('sent') ? { status: 'ok' } : { status: 'error' };
}
