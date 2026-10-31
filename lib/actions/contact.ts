'use server';

import { SITE_URL } from '@/lib/seo';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase-public';

export type ContactResult = { status: 'ok' | 'invalid' | 'error' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAIL_TO = process.env.CONTACT_TO_EMAIL || 'agokcimen2811@gmail.com';

/**
 * Contact form: every message is forwarded to the team inbox through
 * FormSubmit (no API key) and saved to the Supabase `contact_message` table
 * (anon INSERT only, like the waitlist) together with the forwarding result.
 * The send succeeds if either path worked, so a mail-provider outage never
 * loses a message.
 * The hidden `company_website` field is a honeypot: bots that fill it get
 * a fake success and nothing is stored or sent.
 */
export async function sendContact(formData: FormData): Promise<ContactResult> {
  if (String(formData.get('company_website') ?? '').trim()) return { status: 'ok' };

  const subject = String(formData.get('subject') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'en').slice(0, 8);
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

  // Forward first, so the outcome can be stored with the message and a delivery
  // problem can be read from the table instead of guessed at.
  const mailStatus = await forwardByEmail({ subject, email, message });
  if (!mailStatus.startsWith('sent')) console.error('contact: email not sent:', mailStatus);

  const saved = await fetch(`${SUPABASE_URL}/rest/v1/contact_message`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ subject, email, message, locale, mail_status: mailStatus.slice(0, 400) }),
    cache: 'no-store',
  })
    .then((r) => r.ok)
    .catch(() => false);
  if (!saved) console.error('contact: could not save the message');

  return saved || mailStatus.startsWith('sent') ? { status: 'ok' } : { status: 'error' };
}

/**
 * Posts the message to FormSubmit. Returns "sent ..." on success, otherwise the
 * HTTP status and FormSubmit's own words. Never throws. The first message to a
 * new address only triggers an activation email: FormSubmit answers with a
 * message saying so, and that text is kept in `mail_status`.
 */
async function forwardByEmail(m: { subject: string; email: string; message: string }): Promise<string> {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${MAIL_TO}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // FormSubmit's AJAX endpoint expects a browser-like caller.
        Origin: SITE_URL,
        Referer: `${SITE_URL}/`,
      },
      body: JSON.stringify({
        _subject: `[Licits] ${m.subject}`,
        _template: 'table',
        _captcha: 'false',
        _replyto: m.email,
        email: m.email,
        subject: m.subject,
        message: m.message,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
    const ok = res.ok && String(body.success) !== 'false';
    return `${ok ? 'sent' : 'failed'} http ${res.status} success=${String(body.success)}: ${String(body.message ?? '').slice(0, 250)}`;
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
  }
}
