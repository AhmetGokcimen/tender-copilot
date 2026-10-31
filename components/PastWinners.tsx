'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { fetchPastWinnersQuota, lookupPastWinners, type PastWinnersResult } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Icon } from './Icon';

/**
 * On-demand "who won this buyer's last contracts" panel. Nothing is fetched
 * until the user presses the button; the first lookup per tender spends one
 * unit of the monthly quota (the server decides, this only shows it).
 */
export function PastWinners({ externalId }: { externalId: string }) {
  const t = useTranslations('pastWinners');
  const locale = useLocale() === 'ro' ? 'ro-RO' : 'en-US';
  const quota = useQuery({ queryKey: ['past-winners-quota'], queryFn: fetchPastWinnersQuota });
  const [result, setResult] = useState<PastWinnersResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'limit' | 'error'>('idle');

  const q = result?.quota ?? quota.data;
  const left = q ? Math.max(0, q.limit - q.used) : null;
  const fmt = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const ron = (v: number | null) => (v == null ? '—' : `RON ${fmt.format(v)}`);

  const run = async () => {
    setState('loading');
    try {
      setResult(await lookupPastWinners(externalId));
      setState('idle');
      void quota.refetch();
    } catch (e) {
      setState((e as Error).message.includes(' 429') ? 'limit' : 'error');
    }
  };

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <h2 className="mb-space-xs font-headline-sm text-headline-sm text-on-surface">{t('title')}</h2>
      {!result && <p className="mb-space-sm font-body-sm text-body-sm text-on-surface-variant">{t('intro')}</p>}

      {state === 'loading' ? (
        <p className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant" role="status">
          <Icon name="hourglass_top" size="sm" />
          {t('loading')}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={run}
            disabled={state === 'limit' || left === 0}
            className="flex h-10 w-full items-center justify-center gap-space-xs rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="military_tech" size="sm" />
            {result ? t('buttonRepeat') : t('button')}
          </button>
          <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
            {left !== null && q ? `${t('left', { left, limit: q.limit })}. ` : ''}
            {!result && t('costNote')}
          </p>
        </>
      )}

      {(state === 'limit' || (left === 0 && !result)) && (
        <p className="mt-space-xs font-body-sm text-body-sm text-error">{t('limit', { limit: q?.limit ?? 0 })}</p>
      )}
      {state === 'error' && <p className="mt-space-xs font-body-sm text-body-sm text-error">{t('error')}</p>}

      {result && result.items.length === 0 && (
        <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">{t('none')}</p>
      )}
      {result && result.items.length > 0 && (
        <>
          <ul className="mt-space-sm flex flex-col">
            {result.items.map((w, i) => (
              <li key={`${w.title}-${i}`} className="border-b border-surface-container-low py-space-sm last:border-0">
                <p className="font-body-md text-body-md font-medium text-on-surface">{w.winner_name ?? '—'}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {w.url ? (
                    <a href={w.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {w.title}
                    </a>
                  ) : (
                    w.title
                  )}
                </p>
                <p className="tnum font-code-sm text-code-sm text-on-surface-variant">
                  {w.awarded_on ? formatDate(w.awarded_on) : '—'} · {ron(w.value)}
                </p>
                {w.figures ? (
                  <dl className="mt-space-xs grid grid-cols-3 gap-space-xs font-body-sm text-body-sm">
                    <div>
                      <dt className="text-on-surface-variant">{t('turnover')}</dt>
                      <dd className="tnum text-on-surface">{ron(w.figures.turnover)}</dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">{t('profit')}</dt>
                      <dd className="tnum text-on-surface">{ron(w.figures.net_profit)}</dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">{t('employees')}</dt>
                      <dd className="tnum text-on-surface">{w.figures.employees ?? '—'}</dd>
                    </div>
                    <div className="col-span-3 font-code-sm text-code-sm text-on-surface-variant">
                      {t('year', { year: w.figures.year })}
                    </div>
                  </dl>
                ) : (
                  <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">{t('noFigures')}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">{t('caveat')}</p>
        </>
      )}
    </section>
  );
}
