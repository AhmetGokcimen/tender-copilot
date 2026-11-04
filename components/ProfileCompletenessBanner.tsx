'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useCompanyData } from '@/lib/queries';
import { Icon } from '@/components/Icon';

/**
 * Matching, eligibility checks and the bid documents all run on the company
 * profile, so a thin profile means weaker results. This asks for the missing
 * pieces on the dashboard until they are filled in.
 */
export function ProfileCompletenessBanner() {
  const t = useTranslations('completeness');
  const { data } = useCompanyData();
  const [hidden, setHidden] = useState(false);
  if (!data || hidden) return null;

  const c = data.company;
  const missing: string[] = [];
  if (!c.cui) missing.push('cui');
  if (!c.address) missing.push('address');
  if (!c.legal_rep_name) missing.push('rep');
  if (!c.caen_main) missing.push('caen');
  if (data.turnover.length === 0) missing.push('turnover');
  if (data.credentials.length === 0) missing.push('credentials');
  if (data.contracts.length === 0) missing.push('contracts');
  if (missing.length === 0) return null;

  return (
    <section
      data-assistant="profile-completeness"
      role="status"
      className="flex items-start gap-space-md rounded-xl border border-warn/40 bg-warn-bg p-space-md"
    >
      <Icon name="info" size="md" className="mt-0.5 shrink-0 text-warn" />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-label-md text-label-md font-semibold text-on-surface">{t('title')}</p>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {t('body', { items: missing.map((m) => t(`item_${m}`)).join(', ') })}
        </p>
      </div>
      <Link
        href="/app/profile"
        className="inline-flex h-9 shrink-0 items-center rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo hover:bg-indigo-deep"
      >
        {t('cta')}
      </Link>
      <button
        type="button"
        aria-label={t('dismiss')}
        onClick={() => setHidden(true)}
        className="shrink-0 rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
      >
        <Icon name="close" size="sm" />
      </button>
    </section>
  );
}
