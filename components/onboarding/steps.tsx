'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import type { CompanyOptions } from '@/lib/types';
import { CERTS, TRADES, certsFor, searchWorks, workByCpv, type Lang } from '@/lib/construction';
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

/** Empty, or something that reads as a web address (scheme optional). */
export function websiteValid(value: string): boolean {
  const v = value.trim();
  return v === '' || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v);
}

export function IdentityStep({
  name,
  cui,
  website,
  countries,
  onName,
  onCui,
  onWebsite,
  onCountries,
  options,
}: {
  name: string;
  cui: string;
  website: string;
  countries: string[];
  onName: (v: string) => void;
  onCui: (v: string) => void;
  onWebsite: (v: string) => void;
  onCountries: (v: string[]) => void;
  options: CompanyOptions;
}) {
  const siteOk = websiteValid(website);
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
      <label className={LABEL}>
        {t('websiteLabel')}
        <input
          type="url"
          inputMode="url"
          value={website}
          onChange={(e) => onWebsite(e.target.value)}
          placeholder={t('websitePlaceholder')}
          aria-invalid={!siteOk}
          className={clsx(INPUT, !siteOk && 'border-error')}
        />
        {siteOk ? (
          <Hint>{t('websiteHint')}</Hint>
        ) : (
          <span className="font-body-sm text-body-sm font-normal text-error">{t('websiteError')}</span>
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
/* Step 2 — Trades and works (construction catalogue)                  */
/* ------------------------------------------------------------------ */

function WorkChip({
  code,
  label,
  picked,
  onToggle,
}: {
  code: string;
  label: string;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onToggle}
      className={clsx(
        'inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-left text-[13px] transition-colors',
        picked
          ? 'border-indigo bg-indigo text-on-indigo'
          : 'border-line bg-raised text-ink hover:border-indigo hover:text-indigo-text',
      )}
    >
      {picked && <Icon name="check" size="xs" />}
      <span>{label}</span>
      <span className={clsx('tnum font-mono text-[11px]', picked ? 'text-on-indigo/75' : 'text-muted')}>{code}</span>
    </button>
  );
}

export function TradeStep({
  trades,
  cpv,
  blacklist,
  onToggleTrade,
  onToggleCpv,
  onBlacklist,
}: {
  trades: string[];
  cpv: string[];
  blacklist: string[];
  onToggleTrade: (key: string) => void;
  onToggleCpv: (code: string, tradeKey: string) => void;
  onBlacklist: (v: string[]) => void;
}) {
  const t = useTranslations('onboarding');
  const lang: Lang = useLocale() === 'ro' ? 'ro' : 'en';
  const [query, setQuery] = useState('');
  const hits = searchWorks(query);

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-space-xs">
        <span className="font-label-md text-label-md font-semibold text-on-surface">{t('tradesLabel')}</span>
        <div className="grid grid-cols-2 gap-space-xs sm:grid-cols-3">
          {TRADES.map((trade) => {
            const active = trades.includes(trade.key);
            return (
              <button
                key={trade.key}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleTrade(trade.key)}
                className={clsx(
                  'flex min-h-[64px] items-center gap-space-sm rounded-lg border px-space-sm py-space-sm text-left text-[14px] leading-[18px] transition-all duration-150',
                  active
                    ? 'border-indigo bg-indigo-soft font-medium text-indigo-text'
                    : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:-translate-y-0.5 hover:border-indigo hover:shadow-lift-1',
                )}
              >
                <Icon name={trade.icon} size="md" className={active ? 'text-indigo-text' : 'text-on-surface-variant'} />
                {trade.name[lang]}
              </button>
            );
          })}
        </div>
        <Hint>{t('tradesHint')}</Hint>
      </div>

      <div className="flex flex-col gap-space-xs">
        <label htmlFor="ob-work-search" className="font-label-md text-label-md font-semibold text-on-surface">
          {t('worksSearchLabel')}
        </label>
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            id="ob-work-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('worksSearchPlaceholder')}
            data-assistant="ob-cpv-search"
            className={`${INPUT} !pl-9`}
          />
        </div>
        {query.trim().length >= 2 &&
          (hits.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">{t('cpvNoResults')}</p>
          ) : (
            <div className="flex flex-wrap gap-space-xs rounded-lg border border-line bg-sunk/50 p-space-sm">
              {hits.map(({ trade, work }) => (
                <WorkChip
                  key={work.cpv}
                  code={work.cpv}
                  label={work.name[lang]}
                  picked={cpv.includes(work.cpv)}
                  onToggle={() => onToggleCpv(work.cpv, trade.key)}
                />
              ))}
            </div>
          ))}
      </div>

      {trades.length > 0 && (
        <div className="flex flex-col gap-space-md">
          {TRADES.filter((tr) => trades.includes(tr.key)).map((trade) => (
            <section key={trade.key} className="chip-in flex flex-col gap-space-xs">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <Icon name={trade.icon} size="sm" className="text-indigo-text" />
                {trade.name[lang]}
                <span className="font-normal text-muted">
                  · {t('worksPicked', { count: trade.works.filter((w) => cpv.includes(w.cpv)).length })}
                </span>
              </h3>
              <div className="flex flex-wrap gap-space-xs">
                {trade.works.map((work) => (
                  <WorkChip
                    key={work.cpv}
                    code={work.cpv}
                    label={work.name[lang]}
                    picked={cpv.includes(work.cpv)}
                    onToggle={() => onToggleCpv(work.cpv, trade.key)}
                  />
                ))}
              </div>
            </section>
          ))}
          <Hint>{t('worksHint')}</Hint>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="font-label-md text-label-md font-semibold text-on-surface">{t('blacklistLabel')}</span>
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
/* Step 3 — Finances & certificates                                    */
/* ------------------------------------------------------------------ */

export const CURRENCIES = [
  { code: 'EUR', sign: '€' },
  { code: 'RON', sign: '' },
  { code: 'USD', sign: '$' },
] as const;

/** Digits only in, "1.250.000" out (dot groups, as written in Romania). */
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Amount field that groups thousands as you type, with a small currency picker. */
export function MoneyInput({
  id,
  value,
  currency,
  onValue,
  onCurrency,
  hook,
}: {
  id: string;
  value: string;
  currency: string;
  onValue: (digits: string) => void;
  onCurrency: (code: string) => void;
  hook?: string;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="flex w-full max-w-xs items-stretch overflow-hidden rounded-field border border-line bg-raised focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo/20">
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={groupDigits(value)}
        onChange={(e) => onValue(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13))}
        placeholder="0"
        data-assistant={hook}
        className="tnum min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[15px] text-ink outline-none"
      />
      <select
        aria-label={t('currencyLabel')}
        value={currency}
        onChange={(e) => onCurrency(e.target.value)}
        className="border-l border-line bg-sunk px-2 text-[14px] font-medium text-ink outline-none"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.sign ? `${c.sign} ${c.code}` : c.code}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FinanceStep({
  trades,
  turnover,
  turnoverCurrency,
  capacity,
  capacityCurrency,
  certifications,
  onTurnover,
  onTurnoverCurrency,
  onCapacity,
  onCapacityCurrency,
  onCertifications,
}: {
  trades: string[];
  turnover: string;
  turnoverCurrency: string;
  capacity: string;
  capacityCurrency: string;
  certifications: string[];
  onTurnover: (v: string) => void;
  onTurnoverCurrency: (v: string) => void;
  onCapacity: (v: string) => void;
  onCapacityCurrency: (v: string) => void;
  onCertifications: (v: string[]) => void;
}) {
  const t = useTranslations('onboarding');
  const lang: Lang = useLocale() === 'ro' ? 'ro' : 'en';
  const suggested = certsFor(trades);
  const has = (name: string) => certifications.some((c) => c.toLowerCase() === name.toLowerCase());
  const toggle = (name: string) =>
    onCertifications(has(name) ? certifications.filter((c) => c.toLowerCase() !== name.toLowerCase()) : [...certifications, name]);
  const known = new Set(Object.values(CERTS).map((c) => c.name.toLowerCase()));
  const custom = certifications.filter((c) => !known.has(c.toLowerCase()));

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-1">
        <label htmlFor="ob-turnover" className="font-label-md text-label-md font-semibold text-on-surface">
          {t('turnoverLabel')}
        </label>
        <MoneyInput
          id="ob-turnover"
          value={turnover}
          currency={turnoverCurrency}
          onValue={onTurnover}
          onCurrency={onTurnoverCurrency}
          hook="ob-turnover"
        />
        <Hint>{t('turnoverHint')}</Hint>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ob-capacity" className="font-label-md text-label-md font-semibold text-on-surface">
          {t('capacityLabel')}
        </label>
        <MoneyInput
          id="ob-capacity"
          value={capacity}
          currency={capacityCurrency}
          onValue={onCapacity}
          onCurrency={onCapacityCurrency}
          hook="ob-capacity"
        />
        <Hint>{t('capacityHint')}</Hint>
      </div>
      <div className="flex flex-col gap-space-xs">
        <span className="font-label-md text-label-md font-semibold text-on-surface">{t('certsLabel')}</span>
        <Hint>{t('certsHintTrades')}</Hint>
        <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-2">
          {suggested.map((c) => {
            const on = has(c.name);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.name)}
                className={clsx(
                  'flex items-start gap-space-sm rounded-lg border px-space-sm py-space-sm text-left transition-colors',
                  on ? 'border-indigo bg-indigo-soft' : 'border-outline-variant bg-surface-container-lowest hover:border-indigo',
                )}
              >
                <Icon
                  name={on ? 'check_circle' : 'radio_button_unchecked'}
                  size="sm"
                  className={clsx('mt-0.5', on ? 'text-indigo-text' : 'text-on-surface-variant')}
                />
                <span className="flex flex-col">
                  <span className="text-[14px] font-medium leading-[19px] text-ink">{c.name}</span>
                  <span className="text-[12.5px] leading-[17px] text-muted">
                    {c.issuer} · {c.what[lang]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <span className="mt-space-xs text-[13px] font-medium text-ink-2">{t('certsOther')}</span>
        <ChipInput
          values={custom}
          onChange={(next) => onCertifications([...certifications.filter((c) => known.has(c.toLowerCase())), ...next])}
          placeholder={t('certsPlaceholder')}
          inputHook="ob-certs"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Team                                                       */
/* ------------------------------------------------------------------ */

function CountField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const n = Number(value || 0);
  const step = (d: number) => onChange(String(Math.max(0, n + d)));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-label-md text-label-md font-semibold text-on-surface">
        {label}
      </label>
      <div className="flex items-center gap-space-xs">
        <button
          type="button"
          aria-label="−1"
          onClick={() => step(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink hover:border-indigo"
        >
          <Icon name="remove" size="sm" />
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="0"
          className={`${INPUT} tnum !w-24 text-center`}
        />
        <button
          type="button"
          aria-label="+1"
          onClick={() => step(1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink hover:border-indigo"
        >
          <Icon name="add" size="sm" />
        </button>
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}

export function TeamStep({
  eu,
  nonEu,
  onEu,
  onNonEu,
}: {
  eu: string;
  nonEu: string;
  onEu: (v: string) => void;
  onNonEu: (v: string) => void;
}) {
  const t = useTranslations('onboarding');
  const total = Number(eu || 0) + Number(nonEu || 0);
  return (
    <div className="flex flex-col gap-space-lg">
      <p className="font-body-md text-body-md text-on-surface-variant">{t('teamIntro')}</p>
      <CountField id="ob-team-eu" label={t('teamEuLabel')} hint={t('teamEuHint')} value={eu} onChange={onEu} />
      <CountField
        id="ob-team-noneu"
        label={t('teamNonEuLabel')}
        hint={t('teamNonEuHint')}
        value={nonEu}
        onChange={onNonEu}
      />
      <p className="tnum text-[14px] text-ink-2">{t('teamTotal', { count: total })}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Review                                                     */
/* ------------------------------------------------------------------ */

export interface ReviewDraft {
  name: string;
  cui: string;
  website: string;
  countries: string[];
  trades: string[];
  cpv: string[];
  blacklist: string[];
  turnover: string;
  turnoverCurrency: string;
  capacity: string;
  capacityCurrency: string;
  certifications: string[];
  teamEu: string;
  teamNonEu: string;
}

export function ReviewStep({
  draft,
  countryName,
  onJump,
}: {
  draft: ReviewDraft;
  countryName: (code: string) => string;
  onJump: (step: number) => void;
}) {
  const t = useTranslations('onboarding');
  const lang: Lang = useLocale() === 'ro' ? 'ro' : 'en';
  const money = (v: string, cur: string) => (v ? `${groupDigits(v)} ${cur}` : '');
  const rows: { label: string; value: string; step: number }[] = [
    { label: t('reviewName'), value: draft.name, step: 0 },
    { label: t('reviewCui'), value: draft.cui, step: 0 },
    { label: t('reviewWebsite'), value: draft.website, step: 0 },
    { label: t('reviewCountries'), value: draft.countries.map(countryName).join(', '), step: 0 },
    {
      label: t('reviewTrades'),
      value: TRADES.filter((tr) => draft.trades.includes(tr.key))
        .map((tr) => tr.name[lang])
        .join(', '),
      step: 1,
    },
    {
      label: t('reviewWorks'),
      value: [...draft.cpv]
        .sort()
        .map((c) => `${workByCpv(c)?.name[lang] ?? c} (${c})`)
        .join(', '),
      step: 1,
    },
    { label: t('reviewBlacklist'), value: draft.blacklist.join(', '), step: 1 },
    { label: t('reviewTurnover'), value: money(draft.turnover, draft.turnoverCurrency), step: 2 },
    { label: t('reviewCapacity'), value: money(draft.capacity, draft.capacityCurrency), step: 2 },
    { label: t('reviewCerts'), value: draft.certifications.join(', '), step: 2 },
    {
      label: t('reviewTeam'),
      value:
        draft.teamEu || draft.teamNonEu
          ? t('reviewTeamValue', { eu: Number(draft.teamEu || 0), other: Number(draft.teamNonEu || 0) })
          : '',
      step: 3,
    },
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
