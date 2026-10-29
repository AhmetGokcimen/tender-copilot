'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/routing';
import { API_URL, USE_MOCK, fetchOnboardingStatus } from '@/lib/api';
import { qk } from '@/lib/queries';
import { isValidEmail, loginMockUser } from '@/lib/mock-auth';
import { Icon } from '@/components/Icon';
import { AuthShell } from '@/components/ui/AuthShell';
import { buttonClass } from '@/components/ui/Button';
import { INPUT, LABEL } from '@/components/ui/form';

function OAuthButtons({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <>
      <a
        href={`${API_URL}/auth/google/login`}
        className={buttonClass()}
      >
        <Icon name="account_circle" size="sm" />
        {t('googleButton')}
      </a>
      <a
        href={`${API_URL}/auth/demo`}
        className={buttonClass({ variant: 'secondary' })}
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
      <AuthShell title={t('loginTitle')} subtitle={t('loginSub')}>
        <OAuthButtons t={t} />
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t('emailUnavailable')}</p>
        <p className="text-center font-body-md text-body-md text-on-surface-variant">
          {t('needAccount')}{' '}
          <Link href="/auth/signup" className="font-medium text-indigo-text hover:underline">
            {t('signupButton')}
          </Link>
        </p>
        <Link
          href="/"
          className="text-center font-body-md text-body-md text-on-surface-variant hover:underline"
        >
          {t('backHome')}
        </Link>
      </AuthShell>
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
    <AuthShell title={t('loginTitle')}>
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
            className="font-body-sm text-body-sm font-normal text-indigo-text hover:underline"
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
        className={buttonClass()}
      >
        <Icon name="login" size="sm" />
        {t('signinButton')}
      </button>
      <button
        type="button"
        onClick={() => router.push('/app')}
        className={buttonClass({ variant: 'secondary' })}
      >
        <Icon name="bolt" size="sm" />
        {t('demoButton')}
      </button>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t('mockNote')}</p>
      <p className="text-center font-body-md text-body-md text-on-surface-variant">
        {t('needAccount')}{' '}
        <Link href="/auth/signup" className="font-medium text-indigo-text hover:underline">
          {t('signupButton')}
        </Link>
      </p>
    </AuthShell>
  );
}
