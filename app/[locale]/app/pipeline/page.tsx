'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useTenders } from '@/lib/queries';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { KanbanBoard } from '@/components/KanbanBoard';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';

export default function PipelinePage() {
  const t = useTranslations('kanban');
  const tc = useTranslations('common');
  const { data, isLoading, isError, refetch } = useTenders();
  const statuses = usePipelineStore((s) => s.statuses);

  const tracked = useMemo(
    () =>
      (data ?? []).filter(
        (x) => statuses[x.external_id] !== undefined || x.state.status !== 'new',
      ),
    [data, statuses],
  );

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            {t('title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
        </div>
        <Link
          href="/app"
          className="inline-flex h-9 items-center gap-space-xs self-start rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo transition-colors hover:bg-indigo-deep lg:self-center"
        >
          <Icon name="add" size="sm" />
          {t('browse')}
        </Link>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon="error"
          title={tc('error')}
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="h-9 rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo"
            >
              {tc('retry')}
            </button>
          }
        />
      ) : tracked.length === 0 ? (
        <EmptyState
          icon="view_kanban"
          title={t('emptyTitle')}
          hint={t('emptyHint')}
          action={
            <Link
              href="/app"
              className="inline-flex h-9 items-center rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo"
            >
              {t('browse')}
            </Link>
          }
        />
      ) : (
        <div data-assistant="pipeline-board">
          <KanbanBoard tenders={tracked} />
        </div>
      )}
    </div>
  );
}
