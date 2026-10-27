'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link } from '@/i18n/routing';
import { Icon } from './Icon';
import { MatchChip } from './MatchChip';
import { EligibilityChip } from './EligibilityChip';
import type { TenderWithState } from '@/lib/types';
import { formatDate, formatDaysLeft, formatRON } from '@/lib/format';
import { usePipelineStore } from '@/stores/usePipelineStore';

export function TenderCard({ tender }: { tender: TenderWithState }) {
  const t = useTranslations('opportunities');
  const ta = useTranslations('analysis');
  const tp = useTranslations('procedures');
  const tau = useTranslations('authorization');
  const statuses = usePipelineStore((s) => s.statuses);
  const setStatus = usePipelineStore((s) => s.setStatus);
  const untrack = usePipelineStore((s) => s.untrack);

  const override = statuses[tender.external_id];
  const tracked = override !== undefined || tender.state.status !== 'new';

  const eligibilityLabel =
    tender.state.eligible === true
      ? ta('eligible')
      : tender.state.eligible === false
        ? ta('notEligible')
        : ta('uncertain');

  return (
    <article
      data-assistant="tender-card"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm transition-colors hover:border-outline"
    >
      <div className="flex flex-col gap-space-md lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-xs">
            <MatchChip score={tender.state.score} />
            <EligibilityChip eligible={tender.state.eligible} label={eligibilityLabel} />
            <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
              {tender.external_id}
            </span>
          </div>
          <Link
            href={`/app/tenders/${tender.external_id}`}
            className="font-headline-sm text-headline-sm text-on-surface hover:underline"
          >
            {tender.state.ai_title_simplified ?? tender.title}
          </Link>
          <p className="line-clamp-1 font-body-sm text-body-sm text-on-surface-variant">
            {tender.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <Icon name="domain" size="xs" />
              {tender.authority}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="location_on" size="xs" />
              {tender.county}
            </span>
            <span>{tp(tender.procedure_type)}</span>
            <span className="tnum font-code-sm">{tender.cpv_codes.slice(0, 3).join(', ')}</span>
            {tender.state.country_authorization_status !== null &&
              tender.state.country_authorization_status !== 'obtained' && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="info" size="xs" />
                  {tender.country_code} ·{' '}
                  {tender.state.country_authorization_status === 'in_progress'
                    ? tau('statusInProgress')
                    : tau('statusNotStarted')}
                </span>
              )}
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-space-md lg:flex-col lg:items-end">
          <div className="flex flex-col lg:items-end">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              {t('estValue')}
            </span>
            <span className="tnum font-headline-sm text-headline-sm text-on-surface">
              {formatRON(tender.estimated_value, true)}
            </span>
            <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
              {formatDate(tender.submission_deadline)} · {formatDaysLeft(tender.submission_deadline)}
            </span>
          </div>
          <div className="ml-auto flex gap-space-xs lg:ml-0">
            <button
              type="button"
              onClick={() => (tracked ? untrack(tender.external_id) : setStatus(tender.external_id, 'new'))}
              className={clsx(
                'inline-flex h-9 items-center gap-1 rounded px-space-md font-label-md text-label-md transition-colors',
                tracked
                  ? 'bg-surface-container-high text-navy hover:bg-surface-container'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
              )}
            >
              <Icon name={tracked ? 'bookmark_added' : 'bookmark_add'} size="sm" />
              {tracked ? t('tracked') : t('track')}
            </button>
            <Link
              href={`/app/tenders/${tender.external_id}`}
              className="inline-flex h-9 items-center gap-1 rounded bg-navy px-space-md font-label-md text-label-md text-white transition-colors hover:bg-navy-deep"
            >
              {t('viewAnalysis')}
              <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
