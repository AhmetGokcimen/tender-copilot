'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { USE_MOCK } from '@/lib/api';
import { clearToken, useAuthToken } from '@/lib/auth';
import { getMockSession } from '@/lib/mock-auth';
import { useMe, useOnboardingStatus } from '@/lib/queries';

/**
 * Wraps the /app shell. Real mode: no token (or a rejected one) goes to
 * login; no company or an incomplete profile goes to the wizard. Mock
 * mode requires a browser-local mock session (read after mount, since
 * localStorage is unavailable during SSR), then honors the store-derived
 * onboarding status.
 * Children render only once routing is settled — no dashboard flash.
 */
export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const tc = useTranslations('common');
  const token = useAuthToken();
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => setHasSession(getMockSession() !== null), []);
  const me = useMe();
  const status = useOnboardingStatus(
    USE_MOCK || (me.isSuccess && me.data.company_ids.length > 0),
  );

  useEffect(() => {
    if (!USE_MOCK && token !== null && me.isError) clearToken();
  }, [me.isError, token]);

  let dest: string | null = null;
  if (USE_MOCK) {
    if (hasSession === false) dest = '/auth/login';
    else if (hasSession && status.data) dest = status.data.complete ? null : '/onboarding';
  } else if (token === null || me.isError) {
    dest = '/auth/login';
  } else if (me.data) {
    if (me.data.company_ids.length === 0) dest = '/onboarding';
    else if (status.data) dest = status.data.complete ? null : '/onboarding';
  }

  useEffect(() => {
    if (dest) router.replace(dest);
  }, [dest, router]);

  const settled = USE_MOCK
    ? hasSession !== null && status.data !== undefined
    : me.data !== undefined &&
      (me.data.company_ids.length === 0 || status.data !== undefined);

  if (dest || !settled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
        <p className="font-body-md text-body-md text-on-surface-variant">{tc('loading')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
