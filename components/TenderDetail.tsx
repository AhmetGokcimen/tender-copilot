'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link } from '@/i18n/routing';
import { useTender } from '@/lib/queries';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { Icon } from './Icon';
import { MatchChip } from './MatchChip';
import { EligibilityChip } from './EligibilityChip';
import { AuthorizationNotice } from './AuthorizationNotice';
import { EmptyState } from './EmptyState';
import { TenderDocs } from './TenderDocs';
import { daysUntil, formatDate, formatDaysLeft, formatRON } from '@/lib/format';

function Timeline({ pub, clar, sub }: { pub: string | null; clar: string | null; sub: string | null }) {
  const t = useTranslations('analysis');
  const steps = [
    { label: t('published'), date: pub },
    { label: t('clarifications'), date: clar },
    { label: t('deadline'), date: sub },
  ];
  const states = steps.map((s) => {
    const d = daysUntil(s.date);
    if (d === null) return 'unknown';
    return d < 0 ? 'done' : 'upcoming';
  });
  const firstUpcoming = states.indexOf('upcoming');
  return (
    <ol className="flex flex-col gap-space-sm md:flex-row md:items-start">
      {steps.map((s, i) => {
        const state = i === firstUpcoming ? 'current' : states[i];
        return (
          <li key={s.label} className="flex flex-1 items-start gap-space-sm">
            <span className="flex flex-col items-center gap-1">
              <span
                className={clsx(
                  'flex h-6 w-6 items-center justify-center rounded-full border',
                  state === 'done' && 'border-navy bg-surface-container-lowest text-navy',
                  state === 'current' && 'border-indigo bg-indigo text-on-indigo',
                  (state === 'upcoming' || state === 'unknown') &&
                    'border-outline-variant bg-surface-container-lowest text-on-surface-variant',
                )}
              >
                <Icon name={state === 'done' ? 'check' : 'schedule'} size="xs" />
              </span>
              {i < steps.length - 1 && (
                <span className="hidden h-px w-full md:hidden" aria-hidden />
              )}
            </span>
            <span className="flex flex-col pb-space-sm">
              <span className="font-label-md text-label-md text-on-surface">{s.label}</span>
              <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
                {formatDate(s.date)}
              </span>
            </span>
            {i < steps.length - 1 && (
              <span className="mx-space-xs mt-3 hidden h-px flex-1 bg-outline-variant md:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function TenderDetail({ externalId }: { externalId: string }) {
  const t = useTranslations('analysis');
  const tp = useTranslations('procedures');
  const tc = useTranslations('common');
  const { data: tender, isLoading, isError, error, refetch } = useTender(externalId);
  const statuses = usePipelineStore((s) => s.statuses);
  const setStatus = usePipelineStore((s) => s.setStatus);
  const untrack = usePipelineStore((s) => s.untrack);
  const [tab, setTab] = useState<'overview' | 'docs'>('overview');

  const tracked = useMemo(
    () => (tender ? statuses[tender.external_id] !== undefined || tender.state.status !== 'new' : false),
    [tender, statuses],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-space-md" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-container-lowest" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-container-lowest" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-container-lowest" />
      </div>
    );
  }

  if (isError || !tender) {
    const notFound = error instanceof Error && error.message.startsWith('tender-not-found');
    return (
      <div className="flex flex-col items-start gap-space-md">
        <Link href="/app" className="inline-flex items-center gap-1 font-body-md text-body-md text-navy hover:underline">
          <Icon name="arrow_back" size="sm" />
          {t('back')}
        </Link>
        <EmptyState
          icon="find_in_page"
          title={notFound ? t('notFound') : tc('error')}
          hint={notFound ? externalId : undefined}
        />
        {!notFound && (
          <button type="button" onClick={() => refetch()} className="h-9 rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo">
            {tc('retry')}
          </button>
        )}
      </div>
    );
  }

  const eligibilityLabel =
    tender.state.eligible === true ? t('eligible') : tender.state.eligible === false ? t('notEligible') : t('uncertain');

  const rows: [string, string][] = [
    [t('authority'), tender.authority],
    [t('procedure'), `${tp(tender.procedure_type)} · ${tender.county}`],
    [t('cpv'), tender.cpv_codes.join(', ')],
    [t('estValue'), formatRON(tender.estimated_value)],
    [t('published'), formatDate(tender.publication_date)],
    [t('deadline'), `${formatDate(tender.submission_deadline)} · ${formatDaysLeft(tender.submission_deadline)}`],
  ];

  const docs = [
    { name: 'Caiet de sarcini (Specifications).pdf', size: '2.4 MB' },
    { name: 'Contract draft.pdf', size: '310 KB' },
    { name: 'DUAE template.xml', size: '18 KB' },
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <Link href="/app" className="inline-flex items-center gap-1 self-start font-body-md text-body-md text-navy hover:underline">
        <Icon name="arrow_back" size="sm" />
        {t('back')}
      </Link>

      <header className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex flex-wrap items-center gap-space-xs">
          <MatchChip score={tender.state.score} />
          <EligibilityChip eligible={tender.state.eligible} label={eligibilityLabel} />
          <span className="tnum font-code-sm text-code-sm text-on-surface-variant">{tender.external_id}</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
          {tender.state.ai_title_simplified ?? tender.title}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{tender.title}</p>
      </header>

      <div
        role="tablist"
        aria-label={t('tabsLabel')}
        className="inline-flex self-start rounded-full bg-surface-container-high p-0.5"
      >
        {(['overview', 'docs'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx(
              'h-9 rounded-full px-space-md font-label-md text-label-md transition-colors',
              tab === id
                ? 'bg-navy text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {id === 'overview' ? t('tabOverview') : t('tabDocs')}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
      <div className="grid grid-cols-1 items-start gap-gutter-desktop lg:grid-cols-12">
        <div className="flex flex-col gap-space-lg lg:col-span-8">
          <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <h2 className="mb-space-sm font-headline-sm text-headline-sm text-on-surface">{t('summary')}</h2>
            <p className="font-body-lg text-body-lg text-on-surface">{tender.state.ai_summary ?? tender.raw_description ?? '—'}</p>
          </section>

          <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <h2 className="mb-space-sm font-headline-sm text-headline-sm text-on-surface">{t('timeline')}</h2>
            <Timeline pub={tender.publication_date} clar={tender.clarification_deadline} sub={tender.submission_deadline} />
          </section>

          <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <h2 className="mb-space-sm font-headline-sm text-headline-sm text-on-surface">{t('execSheet')}</h2>
            <dl>
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-1 gap-1 border-b border-surface-container-low py-space-sm last:border-0 md:grid-cols-3">
                  <dt className="font-label-md text-label-md text-on-surface-variant">{k}</dt>
                  <dd className="tnum font-body-md text-body-md text-on-surface md:col-span-2">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            data-assistant="eligibility-card"
            className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
          >
            <div className="mb-space-sm flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('eligibility')}</h2>
              <EligibilityChip eligible={tender.state.eligible} label={eligibilityLabel} />
            </div>
            <p className="mb-space-md font-body-md text-body-md text-on-surface">
              <span className="font-semibold">{t('justification')}: </span>
              {tender.state.eligibility_justification ?? '—'}
            </p>
            <AuthorizationNotice
              status={tender.state.country_authorization_status}
              country={tender.country_code}
            />
            <div className="mb-space-md flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-sm">
              <span className="font-label-md text-label-md font-semibold uppercase text-on-surface-variant">
                {t('missingDocs')}
              </span>
              {tender.state.missing_documents.length === 0 ? (
                <span className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
                  <Icon name="check_circle" size="xs" className="text-navy" />
                  {t('missingDocsNone')}
                </span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {tender.state.missing_documents.map((d) => (
                    <li key={d} className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
                      <Icon name="description" size="xs" className="text-on-surface-variant" />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
              <div className="rounded-lg border border-outline-variant bg-surface p-space-md">
                <h3 className="mb-space-xs font-label-md text-label-md uppercase tracking-wider text-on-surface">
                  {t('matched')} ({tender.state.matched_requirements.length})
                </h3>
                <ul className="flex flex-col gap-space-xs">
                  {tender.state.matched_requirements.map((r) => (
                    <li key={r} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface">
                      <Icon name="check_circle" size="xs" className="mt-0.5 text-navy" />
                      {r}
                    </li>
                  ))}
                  {tender.state.matched_requirements.length === 0 && (
                    <li className="font-body-sm text-body-sm text-on-surface-variant">—</li>
                  )}
                </ul>
              </div>
              <div
                data-assistant="unmet-box"
                className="rounded-lg border border-warn/30 bg-warn-bg/50 p-space-md"
              >
                <h3 className="mb-space-xs font-label-md text-label-md uppercase tracking-wider text-warn">
                  {t('unmet')} ({tender.state.unmet_requirements.length})
                </h3>
                <ul className="flex flex-col gap-space-xs">
                  {tender.state.unmet_requirements.map((r) => (
                    <li key={r} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface">
                      <Icon name="warning" size="xs" className="mt-0.5 text-warn" />
                      {r}
                    </li>
                  ))}
                  {tender.state.unmet_requirements.length === 0 && (
                    <li className="font-body-sm text-body-sm text-on-surface-variant">—</li>
                  )}
                </ul>
              </div>
            </div>
          </section>

          <section
            data-assistant="requirements-card"
            className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
          >
            <h2 className="mb-space-sm font-headline-sm text-headline-sm text-on-surface">{t('requirements')}</h2>
            <ul className="flex list-decimal flex-col gap-space-xs pl-6 font-body-md text-body-md text-on-surface">
              {tender.state.extracted_requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {tender.state.extracted_requirements.length === 0 && <li>—</li>}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-space-md lg:col-span-4">
          <section
            data-assistant="score-card"
            className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
          >
            <h2 className="font-label-md text-label-md font-semibold uppercase text-on-surface-variant">{t('score')}</h2>
            <p className="tnum font-headline-xl text-headline-xl text-navy">
              {tender.state.score === null ? '—' : `${tender.state.score}%`}
            </p>
            <h3 className="mb-space-xs mt-space-md font-label-md text-label-md font-semibold text-on-surface">{t('scoreReasons')}</h3>
            <ul className="flex flex-col gap-space-xs">
              {tender.state.score_reasons.map((r) => (
                <li key={r} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                  <Icon name="arrow_right" size="xs" className="mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-space-xs rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <button
              type="button"
              data-assistant="tender-track"
              onClick={() => (tracked ? untrack(tender.external_id) : setStatus(tender.external_id, 'new'))}
              className={clsx(
                'flex h-10 items-center justify-center gap-space-xs rounded-lg font-label-md text-label-md transition-colors',
                tracked ? 'bg-surface-container-high text-navy hover:bg-surface-container' : 'border border-outline-variant text-on-surface hover:bg-surface-container-low',
              )}
            >
              <Icon name={tracked ? 'bookmark_added' : 'bookmark_add'} size="sm" />
              {tracked ? t('tracked') : t('trackTender')}
            </button>
            <button
              type="button"
              data-assistant="tender-generate"
              onClick={() => setTab('docs')}
              className="flex h-10 items-center justify-center gap-space-xs rounded-pill bg-indigo font-label-md text-label-md text-on-indigo transition-colors hover:bg-indigo-deep"
            >
              <Icon name="auto_awesome" size="sm" />
              {t('generateDraft')}
            </button>
            {tender.source_url && (
              <a
                href={tender.source_url}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center justify-center gap-space-xs rounded-lg font-label-md text-label-md text-navy hover:underline"
              >
                {tc('viewOnSeap')}
                <Icon name="open_in_new" size="xs" />
              </a>
            )}
          </section>

          <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <h2 className="mb-space-sm font-headline-sm text-headline-sm text-on-surface">{t('documents')}</h2>
            <ul className="flex flex-col">
              {docs.map((d) => (
                <li key={d.name} className="border-b border-surface-container-low py-space-xs last:border-0">
                  <a
                    href={tender.source_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-space-sm"
                  >
                    <Icon name="description" size="sm" className="text-on-surface-variant" />
                    <span className="min-w-0 flex-1 truncate font-body-md text-body-md text-on-surface group-hover:underline">
                      {d.name}
                    </span>
                    <span className="tnum font-code-sm text-code-sm text-on-surface-variant">{d.size}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      )}

      {tab === 'docs' && <TenderDocs key={tender.external_id} tender={tender} />}
    </div>
  );
}
