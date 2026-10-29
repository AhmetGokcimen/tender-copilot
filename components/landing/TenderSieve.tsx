'use client';

import { useLocale, useTranslations } from 'next-intl';

type Row = {
  id: string;
  title: { en: string; ro: string };
  cpv: string;
  value: number;
  match: boolean;
  reason: string;
};

/** Example construction notices (labelled "Example" on the panel). */
const FEED: Row[] = [
  {
    id: 'CN1072415',
    title: {
      en: 'Thermal rehabilitation of an apartment block, Brașov',
      ro: 'Reabilitare termică bloc de locuințe, Brașov',
    },
    cpv: '45321000-3',
    value: 3840000,
    match: true,
    reason: 'cpvMatch',
  },
  {
    id: 'CN1072398',
    title: {
      en: 'Upgrading county road DJ 107, km 12+300 to 18+750',
      ro: 'Modernizare DJ 107, km 12+300 la 18+750',
    },
    cpv: '45233142-6',
    value: 18600000,
    match: false,
    reason: 'turnover',
  },
  {
    id: 'CN1072442',
    title: {
      en: 'New kindergarten with 6 group rooms, Sânpetru',
      ro: 'Construire grădiniță cu 6 săli de grupă, Sânpetru',
    },
    cpv: '45214100-1',
    value: 7250000,
    match: true,
    reason: 'pastAwards',
  },
  {
    id: 'CN1072409',
    title: {
      en: 'Bridge consolidation over the Olt river, Făgăraș',
      ro: 'Consolidare pod peste râul Olt, Făgăraș',
    },
    cpv: '45221111-3',
    value: 11300000,
    match: false,
    reason: 'experience',
  },
  {
    id: 'CN1072431',
    title: {
      en: 'Sewer network extension, Hărman commune',
      ro: 'Extindere rețea de canalizare, comuna Hărman',
    },
    cpv: '45232400-6',
    value: 4120000,
    match: true,
    reason: 'region',
  },
];

/**
 * Hero visual: a still snapshot of how Lichit reads the SEAP feed. Each
 * example notice carries its verdict and the reason behind it; the
 * winnable ones are collected in the shortlist below.
 */
export function TenderSieve() {
  const t = useTranslations('landing');
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const nf = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-US');
  const ron = (v: number) => `RON ${nf.format(v)}`;
  const shortlist = FEED.filter((r) => r.match);

  return (
    <div className="relative grid w-full max-w-[540px] gap-3">
      <div className="rounded-card border border-line bg-raised p-4 shadow-lift-2">
        <div className="mb-3 flex items-center justify-between px-1 text-[12px] text-muted">
          <span className="font-medium text-ink-2">{t('sieveFeed')}</span>
          <span className="font-mono">
            {t('sieveExample')} · {nf.format(1264)} {t('sieveScanned')}
          </span>
        </div>
        <ul className="grid gap-1.5">
          {FEED.map((row) => (
            <li
              key={row.id}
              className={`rounded-field px-3 py-2 ${row.match ? 'bg-indigo-soft' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{row.title[lang]}</span>
                <span
                  className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                    row.match ? 'bg-eligible-bg text-eligible' : 'text-muted'
                  }`}
                >
                  {row.match ? t('cardEligible') : t('feedSkip')}
                </span>
              </div>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                <span className="font-mono">CPV {row.cpv}</span>
                <span className="font-mono">{ron(row.value)}</span>
                <span>{t(`sieveReason_${row.reason}`)}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-card border border-line bg-raised p-4 sm:ml-12">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[13px] font-medium text-ink">{t('sieveShortlist')}</span>
          <span className="font-mono text-[12px] text-eligible">{shortlist.length}</span>
        </div>
        <ul className="grid gap-1">
          {shortlist.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-1 py-1.5 text-[14px]">
              <span className="min-w-0 truncate text-ink">{row.title[lang]}</span>
              <span className="shrink-0 font-mono text-[12px] text-ink-2">{ron(row.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
