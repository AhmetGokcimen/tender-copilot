'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { loadCompanyData } from '@/lib/company-data';
import { useSession } from '@/lib/session';

/**
 * Wraps the /app shell: signed-out users go to login, users who have not
 * finished onboarding go to the wizard. Same rules in both modes; the
 * session and profile come from Supabase (or the browser in mock mode).
 * Children render only once routing is settled, so there is no dashboard
 * flash.
 */
export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const tc = useTranslations('common');
  const router = useRouter();
  const session = useSession();
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (session.status === 'out') router.replace('/auth/login');
    if (session.status !== 'in') return;
    loadCompanyData()
      .then((d) => {
        const ok = Boolean(d?.company.onboarding_completed_at);
        setDone(ok);
        if (!ok) router.replace('/onboarding');
      })
      .catch(() => setDone(true));
  }, [session.status, router]);

  if (session.status !== 'in' || !done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
        <p className="font-body-md text-body-md text-on-surface-variant">{tc('loading')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
