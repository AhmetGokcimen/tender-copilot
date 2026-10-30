'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useTenders } from '@/lib/queries';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { TenderCard } from '@/components/TenderCard';
import { EmptyState } from '@/components/EmptyState';

/**
 * Tender Analysis landing: every tracked tender as an opportunity card.
 * Tracked = pipeline override exists or API status already beyond 'new'
 * (same predicate as the pipeline board).
 */
export default function TrackedTendersPage() {
  const t = useTranslations('analysis');
  const { data: tenders } = useTenders();
  const statuses = usePipelineStore((s) => s.statuses);

  const tracked = useMemo(
    () =>
      (tenders ?? [])
        .filter((x) => statuses[x.external_id] !== undefined || x.state.status !== 'new')
        .sort((a, b) => (b.state.score ?? -1) - (a.state.score ?? -1)),
    [tenders, statuses],
  );

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex max-w-3xl flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
          {t('indexTitle')}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('indexHint')}</p>
      </header>
      {tracked.length === 0 ? (
        <EmptyState
          icon="find_in_page"
          title={t('indexEmpty')}
          hint={t('indexEmptyHint')}
          action={
            <Link
              href="/app"
              className="inline-flex h-9 items-center gap-1 rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo transition-colors hover:bg-indigo-deep"
            >
              {t('indexBrowse')}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-space-md">
          {tracked.map((x) => (
            <TenderCard key={x.external_id} tender={x} />
          ))}
        </div>
      )}
    </div>
  );
}
