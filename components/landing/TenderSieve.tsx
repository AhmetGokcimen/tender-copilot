'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Row = {
  id: string;
  title: { en: string; ro: string };
  cpv: string;
  value: number;
  match: boolean;
  reason: string;
};

/** Example notices (labelled "Example" on the panel), cycled forever. */
const FEED: Row[] = [
  {
    id: 'CN1071284',
    title: { en: 'IT equipment for 14 schools', ro: 'Echipamente IT pentru 14 școli' },
    cpv: '30213000-5',
    value: 412000,
    match: true,
    reason: 'cpvMatch',
  },
  {
    id: 'CN1071301',
    title: { en: 'Road resurfacing, DN1 km 42', ro: 'Reabilitare carosabil, DN1 km 42' },
    cpv: '45233141-9',
    value: 6100000,
    match: false,
    reason: 'cpvOutside',
  },
  {
    id: 'CN1071296',
    title: {
      en: 'Event services for a city festival',
      ro: 'Servicii de organizare a unui festival',
    },
    cpv: '79952000-2',
    value: 180000,
    match: false,
    reason: 'cpvOutside',
  },
  {
    id: 'CN1071322',
    title: { en: 'Helpdesk and IT support, 24 months', ro: 'Helpdesk și suport IT, 24 de luni' },
    cpv: '72253000-3',
    value: 960000,
    match: true,
    reason: 'pastAwards',
  },
  {
    id: 'CN1071311',
    title: { en: 'Hospital cleaning services', ro: 'Servicii de curățenie pentru spital' },
    cpv: '90910000-9',
    value: 2400000,
    match: false,
    reason: 'turnover',
  },
  {
    id: 'CN1071337',
    title: { en: 'Document management software', ro: 'Software de management al documentelor' },
    cpv: '48311000-1',
    value: 740000,
    match: true,
    reason: 'cpvMatch',
  },
  {
    id: 'CN1071345',
    title: { en: 'School furniture supply', ro: 'Furnizare mobilier școlar' },
    cpv: '39160000-1',
    value: 330000,
    match: false,
    reason: 'cpvOutside',
  },
  {
    id: 'CN1071352',
    title: { en: 'Network cabling for 6 sites', ro: 'Cablare de rețea pentru 6 locații' },
    cpv: '45314300-4',
    value: 520000,
    match: true,
    reason: 'region',
  },
];

const VISIBLE = 5;
const STEP_MS = 1700;

/**
 * Hero visual: SEAP notices stream in, Lichit marks each one, and the
 * winnable ones move to the shortlist. Hovering the feed pauses it and
 * opens the hovered notice's reason. Reduced motion shows a still frame.
 */
export function TenderSieve() {
  const t = useTranslations('landing');
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const [tick, setTick] = useState(VISIBLE);
  const [hovered, setHovered] = useState<string | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (!paused.current) setTick((n) => n + 1);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  // Newest first. The newest row is still "checking"; the rest have a verdict.
  const rows = Array.from({ length: VISIBLE }, (_, i) => {
    const n = tick - i;
    return {
      row: FEED[((n % FEED.length) + FEED.length) % FEED.length],
      key: n,
      checking: i === 0,
    };
  });
  const shortlist: { row: Row; key: number }[] = [];
  for (let n = tick - 1; shortlist.length < 3 && n > tick - 1 - FEED.length * 2; n--) {
    const row = FEED[((n % FEED.length) + FEED.length) % FEED.length];
    if (row.match) shortlist.push({ row, key: n });
  }
  const scanned = 1240 + tick * 3;
  const nf = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-US');
  const ron = (v: number) => `RON ${nf.format(v)}`;

  return (
    <div className="relative grid w-full max-w-[540px] gap-3">
      <div
        className="rounded-card border border-line bg-raised p-4 shadow-lift-2"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => {
          paused.current = false;
          setHovered(null);
        }}
      >
        <div className="mb-3 flex items-center justify-between px-1 text-[12px] text-muted">
          <span className="font-medium text-ink-2">{t('sieveFeed')}</span>
          <span className="font-mono">
            {t('sieveExample')} · {nf.format(scanned)}{' '}
            {t('sieveScanned')}
          </span>
        </div>
        <ul className="grid gap-1.5">
          {rows.map(({ row, key, checking }) => {
            const open = hovered === `${key}`;
            return (
              <li
                key={key}
                onMouseEnter={() => setHovered(`${key}`)}
                className={`sieve-row rounded-field px-3 py-2 transition-[background-color,opacity] duration-500 ${
                  checking ? 'bg-sunk' : row.match ? 'bg-indigo-soft' : 'opacity-45'
                } ${open ? '!opacity-100 ring-1 ring-line-strong' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="hidden font-mono text-[12px] text-muted sm:inline">
                    {row.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {row.title[lang]}
                  </span>
                  <span
                    className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                      checking
                        ? 'text-muted'
                        : row.match
                          ? 'bg-eligible-bg text-eligible'
                          : 'text-muted'
                    }`}
                  >
                    {checking ? t('sieveChecking') : row.match ? t('cardEligible') : t('feedSkip')}
                  </span>
                </div>
                {open && !checking && (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-2">
                    <span className="font-mono">CPV {row.cpv}</span>
                    <span className="font-mono">{ron(row.value)}</span>
                    <span>{t(`sieveReason_${row.reason}`)}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-card border border-line bg-raised p-4 sm:ml-12">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[13px] font-medium text-ink">{t('sieveShortlist')}</span>
          <span className="font-mono text-[12px] text-eligible">{shortlist.length} / 3</span>
        </div>
        <ul className="grid gap-1">
          {shortlist.map(({ row, key }) => (
            <li
              key={key}
              className="sieve-in flex items-center justify-between gap-3 px-1 py-1.5 text-[14px]"
            >
              <span className="min-w-0 truncate text-ink">{row.title[lang]}</span>
              <span className="shrink-0 font-mono text-[12px] text-ink-2">{ron(row.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
