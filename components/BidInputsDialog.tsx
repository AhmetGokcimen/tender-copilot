'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from './Icon';
import { usePriceHint } from '@/lib/queries';
import {
  computePricing,
  parseNumber,
  type BidInputs,
  type Choice,
  type CompanySize,
  type Exclusion,
} from '@/lib/bid-inputs';
import { useBidInputsStore } from '@/stores/useBidInputsStore';
import type { TenderWithState } from '@/lib/types';
import type { Company } from '@/lib/company-data';
import type { TechnicalDraft } from '@/lib/agents';

const FIELD =
  'h-9 w-full rounded-md border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface outline-none focus:border-navy';

function Radio<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T | null;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-space-xs">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={clsx(
            'h-8 rounded-pill border px-space-sm font-label-md text-label-md transition-colors',
            value === o.v
              ? 'border-navy bg-navy text-white'
              : 'border-outline-variant bg-surface text-on-surface hover:border-outline',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fmt = (n: number | null) =>
  n === null ? '—' : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * Shown while the documents are being made: the things only the company can
 * state. Nothing is pre-selected; every answer is the company's own and is
 * confirmed by the person ticking the box at the bottom. Prices are typed
 * here (the tool never invents one) with plain arithmetic for totals and VAT,
 * and a descriptive history of past award prices as context.
 */
export function BidInputsDialog({
  tender,
  company,
  items,
  notes,
  vatRate,
  onSubmit,
  onSkip,
}: {
  tender: TenderWithState;
  company: Company | null;
  /** Points the legal reviewer says only the company can confirm. */
  notes: string[];
  items: TechnicalDraft['price_items'];
  vatRate: number;
  onSubmit: (inputs: BidInputs) => void;
  onSkip: () => void;
}) {
  const t = useTranslations('bidInputs');
  const save = useBidInputsStore((s) => s.save);
  // Read once: a selector that builds a new object each call re-renders forever.
  // The company record is the source of truth for who signs and where the office is.
  const [v, setV] = useState<BidInputs>(() => {
    const base = useBidInputsStore.getState().forTender(tender.external_id);
    return {
      ...base,
      repName: company?.legal_rep_name || base.repName,
      repRole: company?.legal_rep_role || base.repRole,
      address: [company?.address, company?.county].filter(Boolean).join(', ') || base.address,
    };
  });
  const { data: hint } = usePriceHint(tender.external_id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSkip]);

  const pricing = useMemo(() => computePricing(items, v.prices, vatRate), [items, v.prices, vatRate]);
  const estimate = tender.estimated_value;
  const range = hint?.buyer ?? hint?.market ?? null;
  const rangeLei =
    range && estimate
      ? { low: estimate * (1 + range.low_pct / 100), high: estimate * (1 + range.high_pct / 100) }
      : null;
  const belowEstimate = estimate !== null && pricing.subtotal !== null && pricing.subtotal < estimate * 0.75;
  const overEstimate = estimate !== null && pricing.subtotal !== null && pricing.subtotal > estimate;

  const anyAnswer =
    Object.values(v.exclusion).some(Boolean) ||
    v.otherEntities !== null ||
    v.subcontract !== null ||
    v.size !== null ||
    v.repName.trim() !== '' ||
    Object.values(v.prices).some((p) => parseNumber(p) !== null);

  const set = (patch: Partial<BidInputs>) => setV((cur) => ({ ...cur, ...patch }));
  const yn: { v: Choice & string; label: string }[] = [
    { v: 'yes', label: t('yes') },
    { v: 'no', label: t('no') },
  ];
  const sizes: { v: NonNullable<CompanySize>; label: string }[] = (['micro', 'small', 'medium', 'large'] as const).map(
    (s) => ({ v: s, label: t(`size_${s}`) }),
  );
  const ex: { v: NonNullable<Exclusion>; label: string }[] = [
    { v: 'not_applies', label: t('notApplies') },
    { v: 'applies', label: t('applies') },
  ];

  const submit = () => {
    save(tender.external_id, v);
    onSubmit(v);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-space-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div className="flex max-h-[min(92dvh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl">
        <header className="flex items-start justify-between gap-space-sm border-b border-outline-variant px-space-lg py-space-md">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('title')}</h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{t('intro')}</p>
          </div>
          <button type="button" onClick={onSkip} aria-label={t('skip')} className="text-on-surface-variant hover:text-on-surface">
            <Icon name="close" size="sm" />
          </button>
        </header>

        <div className="flex flex-col gap-space-lg overflow-y-auto px-space-lg py-space-md">
          <section className="flex flex-col gap-space-sm">
            <h3 className="font-label-md text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('declTitle')}
            </h3>
            {notes.length > 0 && (
              <div className="rounded-md border border-outline-variant bg-surface-container/50 p-space-sm">
                <p className="font-label-md text-label-md font-semibold text-on-surface">{t('notesTitle')}</p>
                <ul className="mt-1 list-disc pl-5 font-body-sm text-body-sm text-on-surface-variant">
                  {notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            {(['A', 'B', 'C', 'D'] as const).map((g) => (
              <div key={g} className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-space-md">
                <p className="font-body-md text-body-md text-on-surface md:max-w-[60%]">{t(`ground_${g}`)}</p>
                <Radio
                  name={t(`ground_${g}`)}
                  value={v.exclusion[g]}
                  options={ex}
                  onChange={(x) => set({ exclusion: { ...v.exclusion, [g]: x } })}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-space-md">
              <p className="font-body-md text-body-md text-on-surface">{t('otherEntities')}</p>
              <Radio name={t('otherEntities')} value={v.otherEntities} options={yn} onChange={(x) => set({ otherEntities: x })} />
            </div>
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-space-md">
              <p className="font-body-md text-body-md text-on-surface">{t('subcontract')}</p>
              <Radio name={t('subcontract')} value={v.subcontract} options={yn} onChange={(x) => set({ subcontract: x })} />
            </div>
            {v.subcontract === 'yes' && (
              <input
                className={FIELD}
                value={v.subcontractNote}
                onChange={(e) => set({ subcontractNote: e.target.value })}
                placeholder={t('subcontractNote')}
              />
            )}
            <div className="flex flex-col gap-1">
              <p className="font-body-md text-body-md text-on-surface">{t('size')}</p>
              <Radio name={t('size')} value={v.size} options={sizes} onChange={(x) => set({ size: x })} />
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t('sizeHelp')}</p>
            </div>
            <div className="grid grid-cols-1 gap-space-sm md:grid-cols-2">
              <input className={FIELD} value={v.repName} onChange={(e) => set({ repName: e.target.value })} placeholder={t('repName')} />
              <input className={FIELD} value={v.repRole} onChange={(e) => set({ repRole: e.target.value })} placeholder={t('repRole')} />
              <input className={clsx(FIELD, 'md:col-span-2')} value={v.address} onChange={(e) => set({ address: e.target.value })} placeholder={t('address')} />
              <input className={FIELD} inputMode="numeric" value={v.validityDays} onChange={(e) => set({ validityDays: e.target.value })} placeholder={t('validity')} />
            </div>
          </section>

          <section className="flex flex-col gap-space-sm">
            <h3 className="font-label-md text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('priceTitle')}
            </h3>
            {items.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">{t('noItems')}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-outline-variant">
                <table className="w-full min-w-[520px] border-collapse font-body-sm text-body-sm">
                  <thead className="bg-surface-container text-left">
                    <tr>
                      <th className="p-space-xs">{t('colItem')}</th>
                      <th className="p-space-xs">{t('colQty')}</th>
                      <th className="p-space-xs">{t('colUnit')}</th>
                      <th className="p-space-xs text-right">{t('colValue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-outline-variant align-top">
                        <td className="p-space-xs">{it.description}</td>
                        <td className="whitespace-nowrap p-space-xs">
                          {it.quantity || '—'} {it.unit}
                        </td>
                        <td className="p-space-xs">
                          <input
                            className={clsx(FIELD, 'h-8 w-28')}
                            inputMode="decimal"
                            value={v.prices[i] ?? ''}
                            onChange={(e) => set({ prices: { ...v.prices, [i]: e.target.value } })}
                            aria-label={`${t('colUnit')} ${i + 1}`}
                          />
                        </td>
                        <td className="tnum whitespace-nowrap p-space-xs text-right">{fmt(pricing.lines[i]?.value ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-outline-variant bg-surface-container/60">
                    <tr>
                      <td colSpan={3} className="p-space-xs font-semibold">{t('subtotal')}</td>
                      <td className="tnum p-space-xs text-right font-semibold">{fmt(pricing.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-space-xs">{t('vat', { rate: Math.round(vatRate * 100) })}</td>
                      <td className="tnum p-space-xs text-right">{fmt(pricing.vat)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-space-xs font-semibold">{t('total')}</td>
                      <td className="tnum p-space-xs text-right font-semibold">{fmt(pricing.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {estimate !== null && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {t('estimate', { value: fmt(estimate) })}
              </p>
            )}
            {overEstimate && <p className="font-body-sm text-body-sm text-error">{t('overEstimate')}</p>}
            {belowEstimate && <p className="font-body-sm text-body-sm text-on-surface-variant">{t('belowEstimate')}</p>}

            <div className="rounded-md border border-outline-variant bg-surface-container/50 p-space-sm">
              <p className="flex items-center gap-1 font-label-md text-label-md font-semibold text-on-surface">
                <Icon name="insights" size="xs" />
                {t('hintTitle')}
              </p>
              {hint?.locked ? (
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{t('hintLocked')}</p>
              ) : range ? (
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                  {t(hint?.buyer ? 'hintBuyer' : 'hintMarket', {
                    n: range.sample_size,
                    low: range.low_pct,
                    median: range.median_pct,
                    high: range.high_pct,
                  })}
                  {rangeLei && ` ${t('hintLei', { low: fmt(rangeLei.low), high: fmt(rangeLei.high) })}`}
                </p>
              ) : (
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{t('hintNone')}</p>
              )}
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{t('hintDisclaimer')}</p>
            </div>
          </section>

          <label className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
            <input
              type="checkbox"
              checked={v.confirmed}
              onChange={(e) => set({ confirmed: e.target.checked })}
              className="mt-1 h-4 w-4"
            />
            <span>{t('confirm')}</span>
          </label>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-space-sm border-t border-outline-variant px-space-lg py-space-sm">
          <button
            type="button"
            onClick={onSkip}
            className="h-10 rounded-pill px-space-md font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
          >
            {t('skip')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={anyAnswer && !v.confirmed}
            className="h-10 rounded-pill bg-indigo px-space-lg font-label-md text-label-md text-on-indigo hover:bg-indigo-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('create')}
          </button>
        </footer>
      </div>
    </div>
  );
}
