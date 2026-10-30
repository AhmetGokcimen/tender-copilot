'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTenders } from '@/lib/queries';
import { useFilterStore } from '@/stores/useFilterStore';
import { clsx } from 'clsx';

/** Slim secondary metric row. Only `critical` rows may use red. */
function RowMetric({
  icon,
  label,
  value,
  sub,
  critical = false,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  critical?: boolean;
}) {
  return (
    <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-lowest px-space-md py-space-sm shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface">
        <Icon name={icon} size="sm" />
      </span>
      <span className="flex-1 truncate font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {sub && (
        <span className="hidden font-code-sm text-code-sm text-on-surface-variant sm:inline">
          {sub}
        </span>
      )}
      <span className={clsx('tnum font-headline-sm text-headline-sm', critical ? 'text-error' : 'text-navy')}>
        {value}
      </span>
    </div>
  );
}
import { TenderCard } from '@/components/TenderCard';
import { CheckboxRow } from '@/components/CheckboxRow';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { daysUntil, formatRON } from '@/lib/format';
import type { ProcedureType, TenderWithState } from '@/lib/types';
import { INPUT_COMPACT } from '@/components/ui/form';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: TenderWithState[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = 'external_id,title,authority,county,procedure,value_ron,deadline,score,eligible';
  const lines = rows.map((r) =>
    [
      r.external_id,
      r.title,
      r.authority,
      r.county,
      r.procedure_type,
      r.estimated_value ?? '',
      r.submission_deadline ?? '',
      r.state.score ?? '',
      String(r.state.eligible),
    ]
      .map(esc)
      .join(','),
  );
  return [head, ...lines].join('\n');
}

const LABEL = 'font-label-md text-label-md font-semibold text-on-surface';

const PROCEDURES: (ProcedureType | '')[] = ['', 'open', 'restricted', 'negotiated', 'direct', 'framework'];

export default function OpportunitiesPage() {
  const t = useTranslations('opportunities');
  const tp = useTranslations('procedures');
  const tc = useTranslations('common');
  const f = useFilterStore();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const activeFilters =
    Number(!!f.county) + Number(!!f.procedure) + Number(f.minValue != null) + Number(f.minScore > 0) + Number(!!f.cpv) + Number(f.onlyEligible);

  // The filter panel closes on Escape or a click outside it.
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFiltersOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);
  const { data: tenders, isLoading, isError, refetch, isFetching } = useTenders();
  const [exportOpen, setExportOpen] = useState(false);

  const counties = useMemo(
    () => [...new Set((tenders ?? []).map((x) => x.county))].sort(),
    [tenders],
  );

  const filtered = useMemo(() => {
    const q = f.search.trim().toLowerCase();
    const list = (tenders ?? []).filter((x) => {
      if (f.county && x.county !== f.county) return false;
      if (f.procedure && x.procedure_type !== f.procedure) return false;
      if (f.minValue !== null && (x.estimated_value ?? 0) < f.minValue) return false;
      if ((x.state.score ?? 0) < f.minScore) return false;
      if (f.onlyEligible && x.state.eligible !== true) return false;
      if (f.cpv && !x.cpv_codes.some((c) => c.startsWith(f.cpv.trim()))) return false;
      if (
        q &&
        ![x.title, x.authority, x.external_id, x.state.ai_title_simplified ?? '', ...x.cpv_codes]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    const by = {
      match: (a: TenderWithState, b: TenderWithState) => (b.state.score ?? -1) - (a.state.score ?? -1),
      deadline: (a: TenderWithState, b: TenderWithState) =>
        (a.submission_deadline ?? '9999').localeCompare(b.submission_deadline ?? '9999'),
      value: (a: TenderWithState, b: TenderWithState) =>
        (b.estimated_value ?? -1) - (a.estimated_value ?? -1),
    }[f.sort];
    return [...list].sort(by);
  }, [tenders, f]);

  const kpis = useMemo(() => {
    const all = tenders ?? [];
    const fresh = all.filter((x) => {
      const d = daysUntil(x.publication_date);
      return d !== null && d <= 0 && d >= -7;
    }).length;
    const high = all.filter((x) => (x.state.score ?? 0) >= 85).length;
    const value = all.reduce((s, x) => s + (x.estimated_value ?? 0), 0);
    const urgent = all.filter((x) => {
      const d = daysUntil(x.submission_deadline);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    return { total: all.length, fresh, high, value, urgent };
  }, [tenders]);

  return (
    <div className="flex flex-col gap-space-xl">
      <header className="flex flex-col gap-space-md">
        <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
          <div className="flex max-w-3xl flex-col gap-1">
            <div className="flex items-center gap-space-sm">
              <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                {t('title')}
              </h1>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-space-sm self-start lg:self-center">
            <button
              type="button"
              data-assistant="feed-refresh"
              onClick={() => refetch()}
              className="flex h-9 items-center gap-space-xs rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo transition-colors hover:bg-indigo-deep"
            >
              <Icon name="sync" size="sm" className={isFetching ? 'animate-spin' : ''} />
              <span>{t('refresh')}</span>
            </button>
            <div className="relative">
              <button
                type="button"
                title={t('export')}
                onClick={() => setExportOpen((v) => !v)}
                className="rounded bg-surface-container p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <Icon name="file_download" size="sm" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      download('ofera-tenders.json', JSON.stringify(filtered, null, 2), 'application/json');
                      setExportOpen(false);
                    }}
                    className="block w-full px-space-md py-space-sm text-left font-body-md text-body-md text-on-surface hover:bg-surface-container-low"
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      download('ofera-tenders.csv', toCsv(filtered), 'text/csv');
                      setExportOpen(false);
                    }}
                    className="block w-full px-space-md py-space-sm text-left font-body-md text-body-md text-on-surface hover:bg-surface-container-low"
                  >
                    CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-space-md lg:grid-cols-12">
          <div className="relative flex items-center gap-space-md overflow-hidden rounded-xl border border-indigo/15 bg-indigo-soft p-space-lg lg:col-span-5">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgb(var(--ribbon-4-rgb)/0.28),transparent_65%)]"
            />
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-raised text-indigo-text shadow-sm">
              <Icon name="verified" size="md" />
            </span>
            <div className="relative flex min-w-0 flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-indigo-text">
                {t('kpiMatch')}
              </span>
              <div className="flex items-baseline gap-space-xs">
                <span className="tnum text-[40px] font-semibold leading-none text-indigo-deep">{kpis.high}</span>
                <span className="font-code-sm text-code-sm text-ink-2">{t('kpiQualified')}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-space-md lg:col-span-7">
            <RowMetric icon="dataset" label={t('kpiActive')} value={String(kpis.total)} sub={t('kpiActiveDelta', { count: kpis.fresh })} />
            <RowMetric icon="payments" label={t('kpiValue')} value={formatRON(kpis.value, true)} sub={t('kpiPipeline')} />
            <RowMetric icon="timer" label={t('kpiUrgent')} value={String(kpis.urgent)} sub={t('kpiUrgentSub')} critical />
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center gap-space-sm">
          <div ref={filterRef} className="relative">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="feed-filters"
              onClick={() => setFiltersOpen((v) => !v)}
              className={clsx(
                'flex h-9 items-center gap-space-xs rounded-pill border px-space-md font-label-md text-label-md transition-colors',
                filtersOpen || activeFilters > 0
                  ? 'border-indigo bg-indigo-soft text-indigo-text'
                  : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low',
              )}
            >
              <Icon name="tune" size="sm" />
              {t('filtersButton')}
              {activeFilters > 0 && (
                <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo px-1 text-[11px] font-semibold text-on-indigo">
                  {activeFilters}
                </span>
              )}
            </button>
            {filtersOpen && (
              <div
                id="feed-filters"
                role="dialog"
                aria-label={t('filtersTitle')}
                className="absolute left-0 top-11 z-20 flex w-[min(560px,calc(100vw-2rem))] flex-col gap-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('filtersTitle')}</h2>
                  <button type="button" onClick={() => f.reset()} className="font-label-sm text-label-sm text-navy hover:underline">
                    {t('reset')}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                  <div className="flex flex-col gap-space-xs">
                    <label htmlFor="f-county" className={LABEL}>{t('region')}</label>
                    <select id="f-county" className={INPUT_COMPACT} value={f.county} onChange={(e) => f.set({ county: e.target.value })}>
                      <option value="">{tc('all')}</option>
                      {counties.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-space-xs">
                    <label htmlFor="f-proc" className={LABEL}>{t('procedure')}</label>
                    <select id="f-proc" className={INPUT_COMPACT} value={f.procedure} onChange={(e) => f.set({ procedure: e.target.value as ProcedureType | '' })}>
                      {PROCEDURES.map((p) => (
                        <option key={p || 'all'} value={p}>{p === '' ? '—' : tp(p)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-space-xs">
                    <label htmlFor="f-value" className={LABEL}>{t('minValue')}</label>
                    <input id="f-value" type="number" min={0} step={50000} className={`${INPUT_COMPACT} tnum`} placeholder="0" value={f.minValue ?? ''} onChange={(e) => f.set({ minValue: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                  <div className="flex flex-col gap-space-xs">
                    <label htmlFor="f-cpv" className={LABEL}>{t('cpv')}</label>
                    <input id="f-cpv" className={`${INPUT_COMPACT} tnum font-code-sm`} placeholder={t('cpvPlaceholder')} value={f.cpv} onChange={(e) => f.set({ cpv: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-space-xs">
                    <label htmlFor="f-score" className={`${LABEL} flex items-center justify-between`}>
                      <span>{t('minScore')}</span>
                      <span className="tnum font-code-sm text-code-sm text-navy">{f.minScore}%</span>
                    </label>
                    <input id="f-score" type="range" min={0} max={100} step={5} value={f.minScore} onChange={(e) => f.set({ minScore: Number(e.target.value) })} className="w-full accent-accent" />
                  </div>
                  <div className="flex items-end">
                    <CheckboxRow
                      id="f-eligible"
                      label={t('onlyEligible')}
                      checked={f.onlyEligible}
                      onChange={(e) => f.set({ onlyEligible: e.target.checked })}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="h-9 rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo hover:bg-indigo-deep"
                  >
                    {t('filtersShow', { count: filtered.length })}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Icon name="search" size="sm" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              data-assistant="filters-search"
              id="f-search"
              aria-label={t('searchLabel')}
              className={`${INPUT_COMPACT} !rounded-pill !pl-9`}
              placeholder={t('searchPlaceholder')}
              value={f.search}
              onChange={(e) => f.set({ search: e.target.value })}
            />
          </div>
          <div className="ml-auto flex items-center gap-space-md">
            <p className="tnum font-body-md text-body-md text-on-surface-variant">
              {filtered.length} {tc('results')}
            </p>
            <div className="flex items-center gap-space-xs">
              <label htmlFor="sort" className="font-label-md text-label-md text-on-surface-variant">{t('sortBy')}</label>
              <select id="sort" value={f.sort} onChange={(e) => f.set({ sort: e.target.value as 'match' | 'deadline' | 'value' })} className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-space-sm font-body-md text-body-md text-on-surface outline-none focus:border-navy">
                <option value="match">{t('sortMatch')}</option>
                <option value="deadline">{t('sortDeadline')}</option>
                <option value="value">{t('sortValue')}</option>
              </select>
            </div>
          </div>
        </div>
          {isLoading ? (
            <div className="flex flex-col gap-space-md" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-surface-container-lowest" />
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
                  className="h-9 rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo hover:bg-indigo-deep"
                >
                  {tc('retry')}
                </button>
              }
            />
          ) : (tenders ?? []).length === 0 ? (
            <EmptyState
              icon="inbox"
              title={t('emptyFeed')}
              hint={t('emptyFeedHint')}
              action={
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex h-9 items-center gap-space-xs rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo hover:bg-indigo-deep"
                >
                  <Icon name="sync" size="sm" />
                  {t('refresh')}
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="search_off"
              title={t('empty')}
              hint={t('emptyHint')}
              action={
                <button
                  type="button"
                  onClick={() => f.reset()}
                  className="h-9 rounded border border-outline-variant px-space-md font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
                >
                  {t('reset')}
                </button>
              }
            />
          ) : (
            filtered.map((tender) => <TenderCard key={tender.external_id} tender={tender} />)
          )}
      </section>
    </div>
  );
}
