'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/routing';
import { API_URL, USE_MOCK, fetchOnboardingStatus } from '@/lib/api';
import { qk } from '@/lib/queries';
import { isValidEmail, loginMockUser } from '@/lib/mock-auth';
import { Icon } from '@/components/Icon';

const INPUT =
  'h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-space-sm font-body-md text-body-md text-on-surface outline-none focus:border-navy focus:shadow-[0_0_0_3px_rgba(11,19,43,0.12)]';
const LABEL = 'flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-margin py-space-xl">
      <div className="flex w-full max-w-md flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        {children}
      </div>
    </div>
  );
}

function OAuthButtons({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <>
      <a
        href={`${API_URL}/auth/google/login`}
        className="inline-flex h-11 items-center justify-center gap-space-sm rounded-lg bg-navy px-space-lg font-label-md text-label-md font-semibold text-white hover:bg-navy-deep"
      >
        <Icon name="account_circle" size="sm" />
        {t('googleButton')}
      </a>
      <a
        href={`${API_URL}/auth/demo`}
        className="inline-flex h-11 items-center justify-center gap-space-sm rounded-lg border border-outline-variant px-space-lg font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
      >
        <Icon name="bolt" size="sm" />
        {t('demoButton')}
      </a>
    </>
  );
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!USE_MOCK) {
    return (
      <Shell>
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
          {t('loginTitle')}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('loginSub')}</p>
        <OAuthButtons t={t} />
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t('emailUnavailable')}</p>
        <p className="text-center font-body-md text-body-md text-on-surface-variant">
          {t('needAccount')}{' '}
          <Link href="/auth/signup" className="font-semibold text-navy hover:underline">
            {t('signupButton')}
          </Link>
        </p>
        <Link
          href="/"
          className="text-center font-body-md text-body-md text-on-surface-variant hover:underline"
        >
          {t('backHome')}
        </Link>
      </Shell>
    );
  }

  const submit = async () => {
    if (!isValidEmail(email)) return setError(t('emailInvalid'));
    if (password.length === 0) return setError(t('passwordShort'));
    setBusy(true);
    setError(null);
    const { account, error: loginError } = await loginMockUser({ email, password });
    if (!account) {
      setBusy(false);
      setError(loginError === 'unknown' ? t('unknownUser') : t('wrongPassword'));
      return;
    }
    // Finished onboarding before? Dashboard. Otherwise resume the wizard —
    // it derives the step from saved profile data.
    try {
      const status = await queryClient.fetchQuery({
        queryKey: qk.onboardingStatus,
        queryFn: fetchOnboardingStatus,
      });
      router.push(status.complete ? '/app' : '/onboarding');
    } catch {
      router.push('/app');
    }
  };

  return (
    <Shell>
      <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
        {t('loginTitle')}
      </h1>
      <label className={LABEL}>
        {t('emailLabel')}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          data-assistant="login-email"
          className={INPUT}
        />
      </label>
      <label className={LABEL}>
        <span className="flex items-baseline justify-between">
          {t('passwordLabel')}
          <Link
            href="/auth/forgot-password"
            className="font-body-sm text-body-sm font-normal text-navy hover:underline"
          >
            {t('forgotLink')}
          </Link>
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          autoComplete="current-password"
          data-assistant="login-password"
          className={INPUT}
        />
      </label>
      {error && (
        <p className="flex items-start gap-space-xs font-body-md text-body-md text-error">
          <Icon name="error" size="sm" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        data-assistant="login-submit"
        className="inline-flex h-11 items-center justify-center gap-space-sm rounded-lg bg-navy px-space-lg font-label-md text-label-md font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
      >
        <Icon name="login" size="sm" />
        {t('signinButton')}
      </button>
      <button
        type="button"
        onClick={() => router.push('/app')}
        className="inline-flex h-11 items-center justify-center gap-space-sm rounded-lg border border-outline-variant px-space-lg font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
      >
        <Icon name="bolt" size="sm" />
        {t('demoButton')}
      </button>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t('mockNote')}</p>
      <p className="text-center font-body-md text-body-md text-on-surface-variant">
        {t('needAccount')}{' '}
        <Link href="/auth/signup" className="font-semibold text-navy hover:underline">
          {t('signupButton')}
        </Link>
      </p>
    </Shell>
  );
}
