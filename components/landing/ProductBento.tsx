'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '../Icon';

type Key = 'disc' | 'elig' | 'gen' | 'mkt';

/** A slice of brand colour bleeding off a card edge, drifting slowly. */
function Wash({ from, to, rot, className }: { from: string; to: string; rot: number; className: string }) {
  return (
    <div
      aria-hidden
      className={`bento-wash pointer-events-none absolute rounded-[48%] ${className}`}
      style={
        {
          background: `linear-gradient(115deg, var(${from}), var(${to}))`,
          '--wash-rot': `${rot}deg`,
          transform: `rotate(${rot}deg)`,
        } as React.CSSProperties
      }
    />
  );
}

/** Mini UI shell: the product's own surface, sitting on the wash. */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative z-10 w-full rounded-[14px] border border-line bg-raised p-4 shadow-lift-2 md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium text-muted">{children}</p>;
}

/* ---------- Card visuals ---------- */

function DiscoveryVisual({ more = false }: { more?: boolean }) {
  const t = useTranslations('landing');
  const pairs = more ? [1, 2, 3] : [1];
  return (
    <Panel>
      <div className="grid gap-4">
        {pairs.map((n) => (
          <div key={n} className={n > 1 ? 'border-t border-line pt-4' : ''}>
            <Label>{t('pDiscOriginal')}</Label>
            <p className="mt-1 text-[12.5px] leading-[18px] text-muted line-through decoration-line-strong">
              {t(`pDiscOrig${n}`)}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-indigo-text">
              <Icon name="auto_awesome" size="xs" />
              {t('pDiscSimple')}
            </p>
            <p className="mt-1 text-[16px] font-medium tracking-[-0.2px] text-ink">{t(`pDiscPlain${n}`)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {['CPV 45214200-2', 'Brașov', 'RON 2M-5M', t('pDiscOpen')].map((c) => (
          <span key={c} className="rounded-pill border border-line bg-sunk px-2.5 py-1 font-mono text-[11px] text-ink-2">
            {c}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function EligibilityVisual() {
  const t = useTranslations('landing');
  const rows = [
    { k: 'pEligTurnover', need: 'RON 6,000,000', have: 'RON 15,200,000', ok: true },
    { k: 'pEligSimilar', need: t('pEligSimilarNeed'), have: t('pEligSimilarHave'), ok: true },
    { k: 'pEligIso', need: 'ISO 9001', have: t('pEligOnFile'), ok: true },
    { k: 'pEligGuarantee', need: 'RON 38,400', have: '', ok: false },
  ];
  return (
    <Panel>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 text-[11px] font-medium text-muted md:grid-cols-[1.3fr_1fr_1fr_auto]">
        <span>{t('pEligReq')}</span>
        <span className="hidden md:block">{t('pEligNeed')}</span>
        <span className="hidden md:block">{t('pEligYours')}</span>
        <span className="text-right">{t('pEligResult')}</span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((r) => (
          <li
            key={r.k}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-2.5 text-[13px] md:grid-cols-[1.3fr_1fr_1fr_auto]"
          >
            <span className="text-ink">{t(r.k)}</span>
            <span className="hidden font-mono text-[12px] text-ink-2 md:block">{r.need}</span>
            <span className="hidden font-mono text-[12px] text-ink-2 md:block">{r.have || '-'}</span>
            <span
              className={`justify-self-end rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                r.ok ? 'bg-eligible-bg text-eligible' : 'bg-warn-bg text-warn'
              }`}
            >
              {r.ok ? t('pEligMet') : t('pEligUnverified')}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Detail view: the scanned page, the extracted line, and the verdict. */
function EligibilityDetail() {
  const t = useTranslations('landing');
  return (
    <div className="grid gap-3">
      <Panel className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
        <div className="rounded-field border border-line bg-[#f4f1ea] p-4">
          <Label>{t('mEligScan')}</Label>
          <div className="mt-3 grid gap-1.5">
            {[90, 76, 84, 60].map((w, i) => (
              <span key={i} className="h-1.5 rounded-full bg-[#d9d3c4]" style={{ width: `${w}%` }} />
            ))}
            <p className="my-1 rounded bg-[#ffe9a8] px-1.5 py-1 font-mono text-[11px] leading-[16px] text-[#5b4a12]">
              {t('mEligLine')}
            </p>
            {[80, 88, 52].map((w, i) => (
              <span key={i} className="h-1.5 rounded-full bg-[#d9d3c4]" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className="grid content-center gap-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-text">
            <Icon name="document_scanner" size="xs" />
            {t('mEligExtracted')}
          </p>
          <p className="text-[14px] text-ink">{t('mEligReqLine')}</p>
          <p className="text-[14px] text-ink-2">{t('mEligYourLine')}</p>
          <span className="w-fit rounded-pill bg-eligible-bg px-2.5 py-1 text-[12px] font-semibold text-eligible">
            {t('pEligMet')}
          </span>
        </div>
      </Panel>
      <EligibilityVisual />
    </div>
  );
}

function GeneratorVisual({ roles = false }: { roles?: boolean }) {
  const t = useTranslations('landing');
  const agents = [
    { k: 'pGenSpec', done: true },
    { k: 'pGenElig', done: true },
    { k: 'pGenLegal', done: true },
    { k: 'pGenWriter', done: false },
    { k: 'pGenRisk', done: false },
  ];
  return (
    <Panel className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
      <ul className="grid content-start gap-2.5">
        {agents.map((a) => (
          <li key={a.k} className="grid grid-cols-[20px_1fr] gap-2.5 text-[13px]">
            <span
              className={`mt-px flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                a.done ? 'bg-indigo text-on-indigo' : 'border border-line-strong text-muted'
              }`}
            >
              {a.done ? '✓' : ''}
            </span>
            <span>
              <span className={a.done ? 'text-ink' : 'text-muted'}>{t(a.k)}</span>
              {roles && <span className="block text-[12px] leading-[17px] text-muted">{t(`${a.k}Role`)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="rounded-field border border-line bg-paper p-4 pb-2">
        <p className="text-[13px] font-semibold text-ink">{t('pGenDoc')}</p>
        {[
          { h: t('pGenSec1'), by: t('pGenSpec') },
          { h: t('pGenSec2'), by: t('pGenWriter') },
          { h: t('pGenSec3'), by: t('pGenLegal') },
        ].map((s) => (
          <div key={s.h} className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-ink-2">{s.h}</span>
              <span className="shrink-0 rounded-pill bg-indigo-soft px-2 py-0.5 text-[10px] font-medium text-indigo-text">
                {s.by}
              </span>
            </div>
            <div className="mt-1.5 grid gap-1">
              <span className="h-1.5 w-full rounded-full bg-sunk" />
              <span className="h-1.5 w-4/5 rounded-full bg-sunk" />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MarketVisual({ note = false }: { note?: boolean }) {
  const t = useTranslations('landing');
  const lang = useLocale() === 'ro' ? 'ro' : 'en';
  const winners = [
    { name: 'Carpați Construct SRL', n: 4 },
    { name: 'Drumuri Sud SA', n: 2 },
    { name: 'Edil Brașov SRL', n: 1 },
  ];
  const years = ['2021', '2023', '2025', lang === 'ro' ? 'mar. 2027' : 'Mar 2027'];
  return (
    <Panel>
      <Label>{t('pMktWinners')}</Label>
      <ul className="mt-2 grid gap-2">
        {winners.map((w) => (
          <li key={w.name} className="grid grid-cols-[1fr_auto] items-center gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-3">
              <span className="truncate text-ink">{w.name}</span>
              <span className="h-1.5 shrink-0 rounded-full bg-indigo" style={{ width: `${w.n * 22}px` }} />
            </span>
            <span className="font-mono text-[12px] text-ink-2">
              {w.n} {t('pMktContracts')}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] font-medium text-muted">{t('pMktRenewal')}</p>
      <ol className="mt-2 flex items-center">
        {years.map((y, i) => (
          <li key={y} className="flex flex-1 items-center last:flex-none">
            <span
              className={`whitespace-nowrap rounded-pill px-2 py-0.5 font-mono text-[11px] ${
                i < years.length - 1 ? 'bg-sunk text-ink-2' : 'bg-indigo text-on-indigo'
              }`}
            >
              {y}
            </span>
            {i < years.length - 1 && (
              <span
                className={`mx-1.5 h-px flex-1 ${
                  i === years.length - 2 ? 'border-t border-dashed border-indigo' : 'bg-line-strong'
                }`}
              />
            )}
          </li>
        ))}
      </ol>
      {note && <p className="mt-4 text-[12px] leading-[18px] text-ink-2">{t('mMktNote')}</p>}
    </Panel>
  );
}

/* ---------- Cards and the detail window ---------- */

const CARDS: {
  key: Key;
  icon: string;
  span: string;
  wash: [string, string, string, number];
  Visual: () => React.ReactElement;
  Detail: () => React.ReactElement;
}[] = [
  {
    key: 'disc',
    icon: 'travel_explore',
    span: 'lg:col-span-5',
    wash: ['--ribbon-1', '--ribbon-2', '-bottom-24 -left-24 h-56 w-[130%]', -8],
    Visual: () => <DiscoveryVisual />,
    Detail: () => <DiscoveryVisual more />,
  },
  {
    key: 'elig',
    icon: 'fact_check',
    span: 'lg:col-span-7',
    wash: ['--ribbon-2', '--ribbon-3', '-bottom-28 -right-24 h-60 w-[120%]', 10],
    Visual: () => <EligibilityVisual />,
    Detail: () => <EligibilityDetail />,
  },
  {
    key: 'gen',
    icon: 'edit_document',
    span: 'lg:col-span-7',
    wash: ['--ribbon-3', '--ribbon-4', '-bottom-24 -left-28 h-56 w-[125%]', -6],
    Visual: () => <GeneratorVisual />,
    Detail: () => <GeneratorVisual roles />,
  },
  {
    key: 'mkt',
    icon: 'trophy',
    span: 'lg:col-span-5',
    wash: ['--ribbon-1', '--ribbon-4', '-bottom-28 -right-20 h-60 w-[130%]', 9],
    Visual: () => <MarketVisual />,
    Detail: () => <MarketVisual note />,
  },
];

function DetailDialog({ card, onClose }: { card: (typeof CARDS)[number] | null; onClose: () => void }) {
  const t = useTranslations('landing');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current!;
    if (card && !d.open) d.showModal();
    if (!card && d.open) d.close();
  }, [card]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
      aria-labelledby="bento-detail-title"
      className="bento-dialog m-auto w-[calc(100%-32px)] max-w-[1040px] rounded-card border border-line bg-raised p-0 text-ink shadow-lift-2 backdrop:bg-night/40 backdrop:backdrop-blur-sm"
    >
      {card && (
        <div className="relative grid max-h-[85dvh] overflow-y-auto md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="p-7 md:p-9">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-indigo-text">
              <Icon name={card.icon} size="sm" />
              {t(`b_${card.key}Tag`)}
            </p>
            <h3 id="bento-detail-title" className="mt-3 pr-10 text-[28px] font-light leading-[34px] tracking-[-0.8px]">
              {t(`b_${card.key}Title`)}
            </h3>
            <p className="mt-4 text-[15px] leading-[24px] text-ink-2">{t(`m_${card.key}Intro`)}</p>
            <ol className="mt-7 grid gap-5">
              {[1, 2, 3].map((n) => (
                <li key={n} className="grid grid-cols-[28px_1fr] gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-soft font-mono text-[12px] font-semibold text-indigo-text">
                    {n}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium text-ink">{t(`m_${card.key}S${n}Title`)}</p>
                    <p className="mt-1 text-[14px] leading-[22px] text-ink-2">{t(`m_${card.key}S${n}Body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative flex items-center overflow-hidden bg-sunk p-5 md:p-8">
            <Wash
              from={card.wash[0]}
              to={card.wash[1]}
              rot={8}
              className="-bottom-32 -right-24 h-72 w-[140%] opacity-80"
            />
            <div className="relative z-10 w-full">
              <card.Detail />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('bClose')}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-[10px] bg-sunk text-ink-2 transition-colors hover:bg-line hover:text-ink"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}
    </dialog>
  );
}

/** What Lichit does: four product views; each opens a detail window. */
export function ProductBento() {
  const t = useTranslations('landing');
  const [open, setOpen] = useState<Key | null>(null);
  const active = CARDS.find((c) => c.key === open) ?? null;

  return (
    <section id="features" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
      <h2 className="max-w-[760px] text-[32px] font-light leading-[1.15] tracking-[-1px] text-ink md:text-[44px] md:leading-[50px] md:tracking-[-1.3px]">
        {t('productTitleA')} <span className="text-muted">{t('productTitleB')}</span>
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {CARDS.map((c) => (
          <article
            key={c.key}
            onClick={() => setOpen(c.key)}
            className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-card border border-line bg-raised transition-shadow duration-300 hover:shadow-lift-2 ${c.span}`}
          >
            <div className="relative z-10 p-7 pb-0 md:p-8 md:pb-0">
              <div className="flex items-start justify-between gap-4">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-indigo-text">
                  <Icon name={c.icon} size="sm" />
                  {t(`b_${c.key}Tag`)}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(c.key);
                  }}
                  aria-label={`${t('bOpen')}: ${t(`b_${c.key}Title`)}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sunk text-indigo-text transition-colors group-hover:bg-indigo group-hover:text-on-indigo"
                >
                  <Icon name="open_in_full" size="sm" />
                </button>
              </div>
              <h3 className="mt-3 max-w-[22ch] text-[26px] font-light leading-[32px] tracking-[-0.7px] text-ink">
                {t(`b_${c.key}Title`)}
              </h3>
              <p className="mt-3 max-w-[48ch] text-[15px] leading-[23px] text-ink-2">{t(`b_${c.key}Body`)}</p>
            </div>
            <div className="relative mt-8 flex flex-1 items-end px-5 md:px-8">
              <Wash from={c.wash[0]} to={c.wash[1]} rot={c.wash[3]} className={`${c.wash[2]} opacity-90`} />
              <div className="relative z-10 w-full translate-y-px transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-1.5 [&>div]:rounded-b-none [&>div]:border-b-0">
                <c.Visual />
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-muted">{t('productExample')}</p>
      <DetailDialog card={active} onClose={() => setOpen(null)} />
    </section>
  );
}
