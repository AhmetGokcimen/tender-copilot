'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { USE_MOCK } from '@/lib/api';
import { loadCompanyData } from '@/lib/company-data';
import { isValidEmail } from '@/lib/mock-auth';
import { signIn } from '@/lib/session';
import { Icon } from '@/components/Icon';
import { AuthShell } from '@/components/ui/AuthShell';
import { buttonClass } from '@/components/ui/Button';
import { INPUT, LABEL } from '@/components/ui/form';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isValidEmail(email)) return setError(t('emailInvalid'));
    if (password.length === 0) return setError(t('passwordShort'));
    setBusy(true);
    setError(null);
    const loginError = await signIn(email, password);
    if (loginError) {
      setBusy(false);
      setError(
        loginError === 'unknown' ? t('unknownUser') : loginError === 'network' ? t('loginNetwork') : t('wrongPassword'),
      );
      return;
    }
    // Finished onboarding before? Dashboard. Otherwise resume the wizard,
    // which picks up from the saved profile.
    try {
      const data = await loadCompanyData();
      router.push(data?.company.onboarding_completed_at ? '/app' : '/onboarding');
    } catch {
      router.push('/onboarding');
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
      {USE_MOCK && <p className="font-body-sm text-body-sm text-on-surface-variant">{t('mockNote')}</p>}
      <p className="text-center font-body-md text-body-md text-on-surface-variant">
        {t('needAccount')}{' '}
        <span
          aria-disabled="true"
          title={t('signupClosed')}
          className="cursor-not-allowed select-none font-medium text-muted/60"
        >
          {t('signupButton')}
        </span>
      </p>
    </AuthShell>
  );
}
