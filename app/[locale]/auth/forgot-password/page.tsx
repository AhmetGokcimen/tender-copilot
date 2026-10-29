'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { API_URL, USE_MOCK } from '@/lib/api';
import { Icon } from '@/components/Icon';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-margin py-space-xl">
      <div className="flex w-full max-w-md flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
          <Icon name="lock_reset" size="sm" />
        </span>
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
          {t('forgotTitle')}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('forgotBody')}</p>
        {!USE_MOCK && (
          <a
            href={`${API_URL}/auth/google/login`}
            className="inline-flex h-11 items-center justify-center gap-space-sm rounded-lg bg-navy px-space-lg font-label-md text-label-md font-semibold text-white hover:bg-navy-deep"
          >
            <Icon name="account_circle" size="sm" />
            {t('forgotCta')}
          </a>
        )}
        <Link
          href="/auth/login"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-outline-variant px-space-lg font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
        >
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  );
}
