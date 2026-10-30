'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { USE_MOCK } from '@/lib/api';
import { createInvitedAccount } from '@/lib/actions/invite-signup';
import { isValidEmail, registerMockUser } from '@/lib/mock-auth';
import { signIn } from '@/lib/session';
import { Icon } from '@/components/Icon';
import { AuthShell } from '@/components/ui/AuthShell';
import { buttonClass } from '@/components/ui/Button';
import { INPUT, LABEL } from '@/components/ui/form';

export function SignupForm({ invite }: { invite: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim() === '') return setError(t('nameRequired'));
    if (!isValidEmail(email)) return setError(t('emailInvalid'));
    if (password.length < 8) return setError(t('passwordShort'));
    if (company.trim() === '') return setError(t('companyRequired'));
    setBusy(true);
    setError(null);
    if (USE_MOCK) {
      const { error: regError } = await registerMockUser({ name, email, password, company });
      if (regError === 'exists') {
        setBusy(false);
        return setError(t('userExists'));
      }
    } else {
      const res = await createInvitedAccount({ invite, name, email, password, company });
      if (res.status !== 'ok') {
        setBusy(false);
        return setError(
          res.status === 'exists' ? t('userExists') : res.status === 'weak' ? t('passwordShort') : t('signupFailed'),
        );
      }
      if (await signIn(email, password)) {
        setBusy(false);
        return setError(t('signupFailed'));
      }
    }
    router.push('/onboarding');
  };

  return (
    <AuthShell title={t('signupTitle')} subtitle={t('signupSub')} languages={false}>
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
      {USE_MOCK && <p className="font-body-sm text-body-sm text-on-surface-variant">{t('mockNote')}</p>}
      <p className="text-center font-body-md text-body-md text-on-surface-variant">
        {t('haveAccount')}{' '}
        <Link href="/auth/login" className="font-medium text-indigo-text hover:underline">
          {t('signinButton')}
        </Link>
      </p>
    </AuthShell>
  );
}
