'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import type { CompanyOptions } from '@/lib/types';
import { cpvLabel, searchCpv } from '@/lib/cpv';
import { CheckboxRow } from '@/components/CheckboxRow';
import { Icon } from '@/components/Icon';
import { INPUT, LABEL } from '@/components/ui/form';

export { INPUT, LABEL } from '@/components/ui/form';

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">{children}</span>
  );
}

/** RO + 2–10 digits, case-insensitive (MOCK_COMPANY's RO18402933 passes). */
export function cuiValid(value: string): boolean {
  return /^RO\d{2,10}$/i.test(value.trim());
}

export const CERT_SUGGESTIONS = [
  'ISO 9001:2015',
  'ISO/IEC 27001:2022',
  'ISO 14001:2015',
  'ANAF fiscal compliance',
  'ONRC company certificate',
];

/* ------------------------------------------------------------------ */
/* Generic tag/chip input (certifications, blacklist keywords).        */
/* ------------------------------------------------------------------ */

export function ChipInput({
  values,
  onChange,
  suggestions = [],
  placeholder,
  inputHook,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder: string;
  inputHook?: string;
}) {
  const t = useTranslations('onboarding');
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
  };

  const unused = suggestions.filter(
    (s) => !values.some((x) => x.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-space-xs">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-space-xs">
          {values.map((v) => (
            <span
              key={v}
              className="chip-in inline-flex items-center gap-1 rounded-pill bg-indigo-soft px-3 py-1 text-[13px] text-indigo-text"
            >
              {v}
              <button
                type="button"
                aria-label={`${t('chipRemove')}: ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="flex h-4 w-4 items-center justify-center rounded-full text-indigo-text/70 hover:bg-indigo/10 hover:text-indigo-text"
              >
                <Icon name="close" size="xs" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(text);
            setText('');
          }
        }}
        onBlur={() => {
          if (text.trim()) {
            add(text);
            setText('');
          }
        }}
        placeholder={placeholder}
        data-assistant={inputHook}
        className={INPUT}
      />
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-space-xs">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-pill border border-line px-3 py-1 text-[13px] text-muted transition-colors hover:border-indigo hover:text-indigo-text"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Company identity                                           */
/* ------------------------------------------------------------------ */

export function IdentityStep({
  name,
  cui,
  countries,
  onName,
  onCui,
  onCountries,
  options,
}: {
  name: string;
  cui: string;
  countries: string[];
  onName: (v: string) => void;
  onCui: (v: string) => void;
  onCountries: (v: string[]) => void;
  options: CompanyOptions;
}) {
  const t = useTranslations('onboarding');
  const cuiTouched = cui.trim() !== '';
  const cuiOk = cuiValid(cui);
  return (
    <div className="flex flex-col gap-space-md">
      <label className={LABEL}>
        {t('nameLabel')}
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={t('namePlaceholder')}
          autoFocus
          data-assistant="ob-name"
          className={INPUT}
        />
        <Hint>{t('nameHint')}</Hint>
      </label>
      <label className={LABEL}>
        {t('cuiLabel')}
        <input
          value={cui}
          onChange={(e) => onCui(e.target.value.toUpperCase())}
          placeholder={t('cuiPlaceholder')}
          data-assistant="ob-cui"
          aria-invalid={cuiTouched && !cuiOk}
          className={clsx(`${INPUT} tnum`, cuiTouched && !cuiOk && 'border-error')}
        />
        {cuiTouched && !cuiOk ? (
          <span className="font-body-sm text-body-sm font-normal text-error">{t('cuiError')}</span>
        ) : (
          <Hint>{t('cuiHint')}</Hint>
        )}
      </label>
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-1 font-label-md text-label-md font-semibold text-on-surface">
          {t('countriesLabel')}
        </legend>
        {options.countries.map((c) => (
          <CheckboxRow
            key={c.code}
            id={`ob-country-${c.code}`}
            label={`${c.name} (${c.code})`}
            checked={countries.includes(c.code)}
            onChange={() =>
              onCountries(
                countries.includes(c.code)
                  ? countries.filter((k) => k !== c.code)
                  : [...countries, c.code],
              )
            }
          />
        ))}
      </fieldset>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Capacity & certifications                                  */
/* ------------------------------------------------------------------ */

const CURRENCIES = ['RON', 'EUR', 'USD'] as const;

export function MoneyStep({
  amountLabel,
  amountHint,
  amount,
  currency,
  onAmount,
  onCurrency,
}: {
  amountLabel: string;
  amountHint: string;
  amount: string;
  currency: string;
  onAmount: (v: string) => void;
  onCurrency: (v: string) => void;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="flex flex-col gap-space-md">
      <label className={LABEL}>
        {amountLabel}
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          data-assistant="ob-turnover"
          className={`${INPUT} tnum`}
        />
        <Hint>{amountHint}</Hint>
      </label>
      <label className={LABEL}>
        {t('currencyLabel')}
        <select
          value={currency}
          onChange={(e) => onCurrency(e.target.value)}
          className={`${INPUT} max-w-40`}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function CapacityStep({
  turnover,
  turnoverCurrency,
  capacity,
  certifications,
  onTurnover,
  onTurnoverCurrency,
  onCapacity,
  onCertifications,
}: {
  turnover: string;
  turnoverCurrency: string;
  capacity: string;
  certifications: string[];
  onTurnover: (v: string) => void;
  onTurnoverCurrency: (v: string) => void;
  onCapacity: (v: string) => void;
  onCertifications: (v: string[]) => void;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="flex flex-col gap-space-lg">
      <MoneyStep
        amountLabel={t('turnoverLabel')}
        amountHint={t('turnoverHint')}
        amount={turnover}
        currency={turnoverCurrency}
        onAmount={onTurnover}
        onCurrency={onTurnoverCurrency}
      />
      <label className={LABEL}>
        {t('capacityLabel')}
        <input
          type="number"
          min={0}
          value={capacity}
          onChange={(e) => onCapacity(e.target.value)}
          data-assistant="ob-capacity"
          className={`${INPUT} tnum`}
        />
        <Hint>{t('capacityHint')}</Hint>
      </label>
      <div className="flex flex-col gap-1">
        <span className="font-label-md text-label-md font-semibold text-on-surface">
          {t('certsLabel')}
        </span>
        <ChipInput
          values={certifications}
          onChange={onCertifications}
          suggestions={CERT_SUGGESTIONS}
          placeholder={t('certsPlaceholder')}
          inputHook="ob-certs"
        />
        <Hint>{t('certsHint')}</Hint>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Tender preferences (categories → CPV → blacklist)          */
/* ------------------------------------------------------------------ */

export function TenderPrefsStep({
  categories,
  cpv,
  manual,
  blacklist,
  onToggleCategory,
  onToggleCpv,
  onAddManualCpv,
  onManual,
  onBlacklist,
  options,
}: {
  categories: string[];
  cpv: string[];
  manual: boolean;
  blacklist: string[];
  onToggleCategory: (key: string) => void;
  onToggleCpv: (code: string) => void;
  onAddManualCpv: (code: string) => void;
  onManual: (v: boolean) => void;
  onBlacklist: (v: string[]) => void;
  options: CompanyOptions;
}) {
  const t = useTranslations('onboarding');
  const [query, setQuery] = useState('');
  const results = searchCpv(query);

  const suggested = [...new Set(categories.flatMap((key) => {
    const found = options.industries.find((i) => i.key === key);
    return found ? found.suggested_cpv_codes : [];
  }))].sort();
  const visibleSuggested = manual ? suggested.filter((c) => cpv.includes(c)) : suggested;

  return (
    <div className="flex flex-col gap-space-lg">
      {!manual && (
        <fieldset className="flex flex-col gap-space-xs">
          <legend className="mb-1 font-label-md text-label-md font-semibold text-on-surface">
            {t('categoriesLabel')}
          </legend>
          <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-2">
            {options.industries.map((ind) => {
              const active = categories.includes(ind.key);
              return (
                <button
                  key={ind.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleCategory(ind.key)}
                  className={clsx(
                    'flex items-center gap-space-sm rounded-lg border px-space-sm py-space-sm text-left font-body-md text-body-md transition-all duration-150',
                    active
                      ? 'border-indigo bg-indigo-soft font-semibold text-indigo-text'
                      : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:-translate-y-0.5 hover:border-indigo hover:shadow-lift-1',
                  )}
                >
                  <Icon
                    name={active ? 'check_circle' : 'circle'}
                    size="sm"
                    className={active ? 'text-white' : 'text-on-surface-variant'}
                  />
                  {ind.label}
                </button>
              );
            })}
          </div>
          <Hint>{t('categoriesHint')}</Hint>
        </fieldset>
      )}

      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between gap-space-md">
          <span className="font-label-md text-label-md font-semibold text-on-surface">
            {t('cpvLabel')}
          </span>
          <button
            type="button"
            onClick={() => onManual(!manual)}
            aria-pressed={manual}
            className="font-body-sm text-body-sm font-medium text-indigo-text hover:underline"
          >
            {manual ? t('cpvGuided') : t('cpvManual')}
          </button>
        </div>

        {manual ? (
          <div className="flex flex-col gap-space-xs">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('cpvSearchPlaceholder')}
              data-assistant="ob-cpv-search"
              className={`${INPUT} tnum`}
            />
            {query.trim().length < 2 ? (
              <Hint>{t('cpvSearchHint')}</Hint>
            ) : results.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('cpvNoResults')}
              </p>
            ) : (
              <ul className="thin-scroll flex max-h-52 flex-col overflow-y-auto rounded border border-outline-variant">
                {results.map((code) => {
                  const picked = cpv.includes(code);
                  return (
                    <li key={code}>
                      <button
                        type="button"
                        disabled={picked}
                        onClick={() => onAddManualCpv(code)}
                        className="flex w-full items-center gap-space-sm px-space-sm py-space-xs text-left font-body-md text-body-md text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
                      >
                        <span className="tnum font-semibold text-indigo-text">{code}</span>
                        <span className="flex-1 text-on-surface-variant">{cpvLabel(code)}</span>
                        {picked && <Icon name="check" size="sm" className="text-indigo-text" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-space-xs">
            {visibleSuggested.map((code) => (
              <CheckboxRow
                key={code}
                id={`ob-cpv-${code}`}
                label={`${code} — ${cpvLabel(code)}`}
                checked={cpv.includes(code)}
                onChange={() => onToggleCpv(code)}
              />
            ))}
            <Hint>{t('cpvHint')}</Hint>
          </div>
        )}

        {cpv.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              {t('cpvSelected')} ({cpv.length})
            </span>
            <div className="flex flex-wrap gap-space-xs">
              {[...cpv].sort().map((code) => (
                <span
                  key={code}
                  className="chip-in inline-flex items-center gap-1 rounded-pill bg-sunk px-3 py-1 text-[13px] text-ink"
                >
                  <span className="tnum font-semibold">{code}</span>
                  <button
                    type="button"
                    aria-label={`${t('chipRemove')}: ${code}`}
                    onClick={() => onToggleCpv(code)}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                  >
                    <Icon name="close" size="xs" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-label-md text-label-md font-semibold text-on-surface">
          {t('blacklistLabel')}
        </span>
        <ChipInput
          values={blacklist}
          onChange={onBlacklist}
          placeholder={t('blacklistPlaceholder')}
          inputHook="ob-blacklist"
        />
        <Hint>{t('blacklistHint')}</Hint>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Review                                                     */
/* ------------------------------------------------------------------ */

export interface ReviewDraft {
  name: string;
  cui: string;
  countries: string[];
  turnover: string;
  turnoverCurrency: string;
  capacity: string;
  certifications: string[];
  categories: string[];
  cpv: string[];
  blacklist: string[];
}

export function ReviewStep({
  draft,
  industryLabel,
  countryName,
  onJump,
}: {
  draft: ReviewDraft;
  industryLabel: (key: string) => string;
  countryName: (code: string) => string;
  onJump: (step: number) => void;
}) {
  const t = useTranslations('onboarding');
  const rows: { label: string; value: string; step: number }[] = [
    { label: t('reviewName'), value: draft.name, step: 0 },
    { label: t('reviewCui'), value: draft.cui, step: 0 },
    {
      label: t('reviewCountries'),
      value: draft.countries.map(countryName).join(', '),
      step: 0,
    },
    {
      label: t('reviewTurnover'),
      value: draft.turnover ? `${draft.turnover} ${draft.turnoverCurrency}` : '',
      step: 1,
    },
    { label: t('reviewCapacity'), value: draft.capacity ? `${draft.capacity} RON` : '', step: 1 },
    { label: t('reviewCerts'), value: draft.certifications.join(', '), step: 1 },
    {
      label: t('reviewIndustry'),
      value: draft.categories.length > 0 ? industryLabel(draft.categories[0]) : '',
      step: 2,
    },
    { label: t('reviewCpv'), value: [...draft.cpv].sort().join(', '), step: 2 },
    { label: t('reviewBlacklist'), value: draft.blacklist.join(', '), step: 2 },
  ];
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center gap-space-md border-b border-outline-variant py-space-xs last:border-b-0"
        >
          <dt className="w-40 shrink-0 font-label-md text-label-md text-on-surface-variant">
            {row.label}
          </dt>
          <dd className="tnum flex-1 font-body-md text-body-md text-on-surface">
            {row.value || <span className="text-on-surface-variant">{t('reviewEmpty')}</span>}
          </dd>
          <dd>
            <button
              type="button"
              onClick={() => onJump(row.step)}
              className="font-body-sm text-body-sm font-medium text-indigo-text hover:underline"
            >
              {t('reviewEdit')}
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Progress trace + setup interstitial                                 */
/* ------------------------------------------------------------------ */

export function OnboardingProgress({
  step,
  titles,
}: {
  step: number;
  titles: string[];
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="flex flex-col gap-space-xs" data-assistant="ob-progress">
      <span className="tnum font-label-md text-label-md font-semibold text-on-surface-variant">
        {t('stepOf', { current: step + 1, total: titles.length })}
      </span>
      <div className="relative flex items-center justify-between" aria-hidden>
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-surface-container-high" />
        <div
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-indigo transition-all duration-300 ease-out"
          style={{ width: `${(step / (titles.length - 1)) * 100}%` }}
        />
        {titles.map((title, i) => (
          <span
            key={title}
            title={title}
            className={clsx(
              'relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-300',
              i < step && 'border-indigo bg-indigo text-on-indigo',
              i === step && 'border-indigo bg-raised',
              i > step && 'border-outline-variant bg-surface-container-lowest',
            )}
          >
            {i < step && <Icon name="check" size="xs" />}
            {i === step && <span className="h-2 w-2 rounded-full bg-indigo" />}
          </span>
        ))}
      </div>
      <div className="flex justify-between">
        {titles.map((title, i) => (
          <span
            key={title}
            className={clsx(
              'max-w-28 truncate font-label-sm text-label-sm first:text-left last:text-right',
              i === step ? 'font-semibold text-on-surface' : 'text-on-surface-variant',
            )}
          >
            {title}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SetupInterstitial() {
  const t = useTranslations('onboarding');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface/95 px-margin">
      <div className="flex w-full max-w-sm flex-col items-center gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div className="setup-sweep absolute inset-0 rounded-full bg-indigo" />
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('setupTitle')}</p>
      </div>
    </div>
  );
}
