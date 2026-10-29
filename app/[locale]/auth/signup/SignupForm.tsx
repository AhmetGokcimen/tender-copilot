'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/routing';
import { API_URL, USE_MOCK } from '@/lib/api';
import { qk } from '@/lib/queries';
import { isValidEmail, registerMockUser } from '@/lib/mock-auth';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { Icon } from '@/components/Icon';
import { AuthShell } from '@/components/ui/AuthShell';
import { buttonClass } from '@/components/ui/Button';
import { INPUT, LABEL } from '@/components/ui/form';

export function SignupForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!USE_MOCK) {
    return (
      <AuthShell title={t('signupTitle')} subtitle={t('signupSub')}>
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
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t('emailUnavailable')}</p>
        <p className="text-center font-body-md text-body-md text-on-surface-variant">
          {t('haveAccount')}{' '}
          <Link href="/auth/login" className="font-medium text-indigo-text hover:underline">
            {t('signinButton')}
          </Link>
        </p>
      </AuthShell>
    );
  }

  const submit = async () => {
    if (name.trim() === '') return setError(t('nameRequired'));
    if (!isValidEmail(email)) return setError(t('emailInvalid'));
    if (password.length < 8) return setError(t('passwordShort'));
    if (company.trim() === '') return setError(t('companyRequired'));
    setBusy(true);
    setError(null);
    const { error: regError } = await registerMockUser({ name, email, password, company });
    if (regError === 'exists') {
      setBusy(false);
      setError(t('userExists'));
      return;
    }
    // A new account starts with a blank company: onboarding fills it in.
    useCompanyStore.getState().resetToEmpty();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.company }),
      queryClient.invalidateQueries({ queryKey: qk.onboardingStatus }),
      queryClient.invalidateQueries({ queryKey: qk.me }),
    ]);
    router.push('/onboarding');
  };

  return (
    <AuthShell title={t('signupTitle')} subtitle={t('signupSub')}>
      <label className={LABEL}>
        {t('nameLabel')}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          autoComplete="name"
          data-assistant="signup-name"
          className={INPUT}
        />
      </label>
      <label className={LABEL}>
        {t('emailLabel')}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          data-assistant="signup-email"
          className={INPUT}
        />
      </label>
      <label className={LABEL}>
        {t('passwordLabel')}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          data-assistant="signup-password"
          className={INPUT}
        />
        <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">
          {t('passwordHint')}
        </span>
      </label>
      <label className={LABEL}>
        {t('companyLabel')}
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          autoComplete="organization"
          data-assistant="signup-company"
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
        data-assistant="signup-submit"
        className={buttonClass()}
      >
        <Icon name="person_add" size="sm" />
        {t('signupButton')}
      </button>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t('mockNote')}</p>
      <p className="text-center font-body-md text-body-md text-on-surface-variant">
        {t('haveAccount')}{' '}
        <Link href="/auth/login" className="font-medium text-indigo-text hover:underline">
          {t('signinButton')}
        </Link>
      </p>
    </AuthShell>
  );
}
