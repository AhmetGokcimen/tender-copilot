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
import { AuthShell } from '@/components/ui/AuthShell';
import { buttonClass } from '@/components/ui/Button';

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
      <AuthShell title={t('callbackErrorTitle')} subtitle={error}>
        <Link href="/auth/login" className={buttonClass()}>
          {t('backToLogin')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface px-4">
      <p className="flex items-center gap-2 text-[15px] text-muted">
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
