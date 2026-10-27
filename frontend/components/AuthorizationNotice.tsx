'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { AuthorizationStatus } from '@/lib/types';
import { Icon } from '@/components/Icon';

/**
 * Standalone readiness notice for the tender detail screen. Deliberately
 * separate from the eligibility verdict chip: obtained (or no row at all)
 * renders nothing, anything else renders a neutral reminder — never an
 * alarm, never merged with eligible/not-eligible.
 */
export function AuthorizationNotice({
  status,
  country,
}: {
  status: AuthorizationStatus | null;
  country: string;
}) {
  const t = useTranslations('authorization');
  if (status === null || status === 'obtained') return null;

  const statusLabel =
    status === 'in_progress' ? t('statusInProgress') : t('statusNotStarted');

  return (
    <div className="mb-space-md flex items-start gap-space-sm rounded border border-outline-variant bg-surface-container-low p-space-md">
      <Icon name="info" size="sm" className="mt-0.5 shrink-0 text-navy" />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-label-md text-label-md font-semibold text-on-surface">
          {t('boxTitle')}
        </p>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {t('boxBody', { status: statusLabel, country })}
        </p>
        <Link
          href="/onboarding"
          className="w-fit font-body-md text-body-md text-navy hover:underline"
        >
          {t('reviewLink')}
        </Link>
      </div>
    </div>
  );
}
