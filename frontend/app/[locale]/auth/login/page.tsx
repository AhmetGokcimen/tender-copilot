'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { API_URL, USE_MOCK } from '@/lib/api';
import { Icon } from '@/components/Icon';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  if (USE_MOCK) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
        <div className="flex w-full max-w-md flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            {t('loginTitle')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('loginSub')}</p>
          <button
            type="button"
            onClick={() => router.push('/app')}
            className="inline-flex h-11 items-center justify-center gap-space-sm rounded-lg bg-navy px-space-lg font-label-md text-label-md font-semibold text-white hover:bg-navy-deep"
          >
            <Icon name="login" size="sm" />
            {t('demoButton')}
          </button>
          <Link href="/" className="text-center font-body-md text-body-md text-on-surface-variant hover:underline">
            {t('backHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
      <div className="flex w-full max-w-md flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
          {t('loginTitle')}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('loginSub')}</p>
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
        <Link href="/" className="text-center font-body-md text-body-md text-on-surface-variant hover:underline">
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
