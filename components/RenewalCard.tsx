'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { fetchRenewal } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Icon } from './Icon';

const pct = (v: number, locale: string) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(v))}%`;

/**
 * Shown only when the buyer re-tenders this kind of work on a rhythm. The
 * wording stays descriptive of past awards (what happened, not what to bid).
 */
export function RenewalCard({ externalId }: { externalId: string }) {
  const t = useTranslations('renewal');
  const locale = useLocale() === 'ro' ? 'ro-RO' : 'en-US';
  const { data } = useQuery({ queryKey: ['renewal', externalId], queryFn: () => fetchRenewal(externalId), retry: false });
  const r = data?.renewal;
  if (!r?.detected) return null;
  const p = data?.price_range;

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <h2 className="mb-space-xs flex items-center gap-space-xs font-headline-sm text-headline-sm text-on-surface">
        <Icon name="autorenew" size="sm" />
        {t('title')}
      </h2>
      <p className="font-body-md text-body-md text-on-surface">
        {t('detected', { days: Math.round(r.avg_interval_days ?? 0) })}
        {r.next_expected_date ? ` ${t('next', { date: formatDate(r.next_expected_date) })}` : ''}
      </p>
      <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
        {t('basis', { count: r.prior_count, level: t(`confidence_${r.confidence ?? 'low'}`) })}
      </p>

      {p && (
        <div className="mt-space-md border-t border-surface-container-low pt-space-md">
          <h3 className="font-label-md text-label-md font-semibold text-on-surface">{t('priceTitle')}</h3>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface">
            {t('priceBody', {
              n: p.sample_size,
              low: pct(p.low_pct, locale),
              high: pct(p.high_pct, locale),
              median: pct(p.median_pct, locale),
            })}
          </p>
          <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">{t('priceNote')}</p>
        </div>
      )}
      {data?.price_locked && (
        <p className="mt-space-md border-t border-surface-container-low pt-space-md font-body-sm text-body-sm text-on-surface-variant">
          {t('locked')}
        </p>
      )}
    </section>
  );
}
