'use server';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase-public';

export type ContactResult = { status: 'ok' | 'invalid' | 'error' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAIL_TO = process.env.CONTACT_TO_EMAIL || 'agokcimen2811@gmail.com';

/**
 * Contact form: every message is saved to the Supabase `contact_message`
 * table (anon INSERT only, like the waitlist) and forwarded to the team
 * inbox through FormSubmit, which needs no API key. The send succeeds if
 * either path worked, so a mail-provider outage never loses a message.
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

  const store = fetch(`${SUPABASE_URL}/rest/v1/contact_message`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ subject, email, message, locale }),
    cache: 'no-store',
  }).then((r) => {
    if (!r.ok) throw new Error(`store ${r.status}`);
  });

  const forward = fetch(`https://formsubmit.co/ajax/${encodeURIComponent(MAIL_TO)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: `[Licits] ${subject}`,
      _template: 'table',
      _replyto: email,
      email,
      subject,
      message,
    }),
    cache: 'no-store',
  }).then(async (r) => {
    const body = (await r.json().catch(() => ({}))) as { success?: string | boolean };
    if (!r.ok || String(body.success) === 'false') throw new Error(`forward ${r.status}`);
  });

  const [saved, sent] = await Promise.allSettled([store, forward]);
  for (const r of [saved, sent]) if (r.status === 'rejected') console.error('contact:', r.reason);
  return saved.status === 'fulfilled' || sent.status === 'fulfilled' ? { status: 'ok' } : { status: 'error' };
}
