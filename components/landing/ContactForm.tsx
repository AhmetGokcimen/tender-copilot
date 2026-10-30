'use client';

import { useId, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { sendContact } from '@/lib/actions/contact';
import { INPUT, LABEL } from '@/components/ui/form';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type State = 'idle' | 'invalid' | 'error' | 'done';

/** Subject, email and message. Sends through the `sendContact` server action. */
export function ContactForm() {
  const t = useTranslations('contact');
  const locale = useLocale();
  const id = useId();
  const [state, setState] = useState<State>('idle');
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const ok =
      String(data.get('subject') ?? '').trim() &&
      EMAIL.test(String(data.get('email') ?? '').trim()) &&
      String(data.get('message') ?? '').trim();
    if (!ok) {
      setState('invalid');
      return;
    }
    startTransition(async () => {
      try {
        const res = await sendContact(data);
        setState(res.status === 'ok' ? 'done' : res.status);
      } catch {
        setState('error');
      }
    });
  };

  if (state === 'done') {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-card bg-eligible-bg px-[18px] py-4 text-[15px] text-ink"
      >
        <span aria-hidden className="font-semibold text-eligible">
          ✓
        </span>
        {t('formSuccess')}
      </div>
    );
  }

  const bad = state === 'invalid' || state === 'error';
  const reset = () => bad && setState('idle');
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative flex flex-col gap-4 rounded-card border border-line bg-raised p-6 shadow-lift-1 md:p-8"
    >
      <label className={LABEL} htmlFor={`${id}-subject`}>
        {t('formSubject')}
        <input
          id={`${id}-subject`}
          name="subject"
          required
          maxLength={150}
          onChange={reset}
          className={INPUT}
        />
      </label>
      <label className={LABEL} htmlFor={`${id}-email`}>
        {t('formEmail')}
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          onChange={reset}
          className={INPUT}
        />
      </label>
      <label className={LABEL} htmlFor={`${id}-message`}>
        {t('formMessage')}
        <textarea
          id={`${id}-message`}
          name="message"
          required
          rows={6}
          maxLength={5000}
          onChange={reset}
          className="w-full resize-y rounded-field border border-line-strong bg-raised px-3 py-2.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-indigo focus:shadow-[0_0_0_3px_var(--indigo-soft)]"
        />
      </label>
      <input
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0"
      />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded-pill bg-indigo px-6 py-3 text-[15px] font-medium text-on-indigo transition-colors hover:bg-indigo-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo active:scale-[0.98] disabled:cursor-progress disabled:opacity-70"
        >
          {pending ? t('formSending') : t('formSend')}
        </button>
        <p aria-live="polite" className={`text-[13px] ${bad ? 'text-risk' : 'text-muted'}`}>
          {state === 'invalid' ? t('formInvalid') : state === 'error' ? t('formError') : ''}
        </p>
      </div>
    </form>
  );
}
