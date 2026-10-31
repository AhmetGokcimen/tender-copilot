/**
 * Where contact messages are emailed. FormSubmit refuses requests that come
 * from servers (HTTP 403), so the browser sends the email itself and this
 * address is public in the page. Use a mailbox that may be public.
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'agokcimen2811@gmail.com';

/**
 * Posts a message to FormSubmit from the browser. Returns "sent ..." on
 * success, otherwise the HTTP status and FormSubmit's own words. Never throws.
 * The first message to a new address only triggers an activation email; the
 * answer says so, and it is stored with the message as `mail_status`.
 */
export async function emailContact(m: { subject: string; email: string; message: string }): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: `[Licits] ${m.subject}`,
        _template: 'table',
        _captcha: 'false',
        _replyto: m.email,
        email: m.email,
        subject: m.subject,
        message: m.message,
      }),
      signal: ctrl.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
    const ok = res.ok && String(body.success) !== 'false';
    return `${ok ? 'sent' : 'failed'} http ${res.status} success=${String(body.success)}: ${String(body.message ?? '').slice(0, 250)}`;
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
  } finally {
    clearTimeout(timer);
  }
}
