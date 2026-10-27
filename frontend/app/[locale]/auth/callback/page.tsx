'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/routing';
import { qk } from '@/lib/queries';
import { fetchMe } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { Icon } from '@/components/Icon';

function CallbackInner() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(t('callbackError'));
      return;
    }
    setToken(token);
    queryClient
      .fetchQuery({ queryKey: qk.me, queryFn: fetchMe })
      .then((me) => {
        router.replace(me.company_ids.length > 0 ? '/app' : '/onboarding');
      })
      .catch(() => setError(t('callbackError')));
  }, [searchParams, queryClient, router, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
        <div className="flex w-full max-w-md flex-col items-start gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <span className="flex items-center gap-space-sm font-headline-sm text-headline-sm text-on-surface">
            <Icon name="error" size="md" />
            {t('callbackErrorTitle')}
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant">{error}</p>
          <Link
            href="/auth/login"
            className="inline-flex h-9 items-center rounded bg-navy px-space-md font-label-md text-label-md text-white hover:bg-navy-deep"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
      <p className="flex items-center gap-space-sm font-body-md text-body-md text-on-surface-variant">
        <Icon name="progress_activity" size="sm" />
        {t('callbackLoading')}
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
