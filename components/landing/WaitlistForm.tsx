'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { joinWaitlist } from '@/lib/actions/waitlist';
import { Magnetic } from './MagneticButton';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type State = 'idle' | 'invalid' | 'error' | 'done';

/** Email-only waitlist field with the primary CTA inside one pill. */
export function WaitlistForm({ source, onDark = false }: { source: 'hero' | 'closing'; onDark?: boolean }) {
  const t = useTranslations('landing');
  const locale = useLocale();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>('idle');
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (!EMAIL.test(String(data.get('email') ?? '').trim())) {
      setState('invalid');
      inputRef.current?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const res = await joinWaitlist(data);
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
        className="flex max-w-[480px] items-center gap-3 rounded-card bg-eligible-bg px-[18px] py-4 text-[15px] text-ink"
      >
        <span aria-hidden className="font-semibold text-eligible">
          ✓
        </span>
        {t('wlSuccess')}
      </div>
    );
  }

  const bad = state === 'invalid' || state === 'error';
  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-[480px]">
      <label
        htmlFor={id}
        className={`mb-2 block text-[13px] font-medium ${onDark ? 'text-on-night' : 'text-ink-2'}`}
      >
        {t('wlLabel')}
      </label>
      <div
        className={`flex gap-2 rounded-pill border bg-raised py-[5px] pl-[18px] pr-[5px] transition-[border-color,box-shadow] duration-200 focus-within:border-indigo focus-within:shadow-[0_0_0_3px_var(--indigo-soft)] ${
          bad ? 'border-risk' : 'border-line-strong'
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t('wlPlaceholder')}
          aria-invalid={bad}
          aria-describedby={`${id}-msg`}
          onChange={() => bad && setState('idle')}
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
        <input
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute -left-[9999px] h-0 w-0"
        />
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="locale" value={locale} />
        <Magnetic>
          <button
            type="submit"
            disabled={pending}
            className="whitespace-nowrap rounded-pill bg-indigo px-5 py-3 text-[15px] font-medium text-on-indigo hover:bg-indigo-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo active:scale-[0.98] disabled:cursor-progress disabled:opacity-70"
          >
            {pending ? t('wlSubmitting') : t('wlCta')}
          </button>
        </Magnetic>
      </div>
      <p
        id={`${id}-msg`}
        aria-live="polite"
        className={`mt-2.5 min-h-4 text-[12px] ${bad ? (onDark ? 'text-[#ff8a7a]' : 'text-risk') : onDark ? 'text-[#a9b0c2]' : 'text-muted'}`}
      >
        {state === 'invalid' ? t('wlInvalid') : state === 'error' ? t('wlError') : t('wlHelp')}
      </p>
    </form>
  );
}
