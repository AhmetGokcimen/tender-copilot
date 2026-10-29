'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { API_URL, USE_MOCK } from '@/lib/api';
import { Icon } from '@/components/Icon';
import { AuthShell } from '@/components/ui/AuthShell';
import { buttonClass } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  return (
    <AuthShell title={t('forgotTitle')} subtitle={t('forgotBody')}>
      {!USE_MOCK && (
        <a href={`${API_URL}/auth/google/login`} className={buttonClass()}>
          <Icon name="account_circle" size="sm" />
          {t('forgotCta')}
        </a>
      )}
      <Link href="/auth/login" className={buttonClass({ variant: 'secondary' })}>
        {t('backToLogin')}
      </Link>
    </AuthShell>
  );
}
