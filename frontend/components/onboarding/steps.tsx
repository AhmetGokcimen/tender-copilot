'use client';

import { useTranslations } from 'next-intl';
import type { CompanyOptions } from '@/lib/types';
import { CheckboxRow } from '@/components/CheckboxRow';
import { Icon } from '@/components/Icon';

export const INPUT =
  'h-10 w-full rounded border border-outline-variant bg-surface-container-lowest px-space-sm font-body-md text-body-md text-on-surface outline-none focus:border-navy focus:shadow-[0_0_0_3px_rgba(11,19,43,0.12)]';

export const LABEL =
  'flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface';

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">{children}</span>
  );
}

export function NameStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('onboarding');
  return (
    <label className={LABEL}>
      {t('nameLabel')}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('namePlaceholder')}
        autoFocus
        className={INPUT}
      />
      <Hint>{t('nameHint')}</Hint>
    </label>
  );
}

export function BasicsStep({
  industry,
  foundedYear,
  onIndustry,
  onFoundedYear,
  options,
}: {
  industry: string;
  foundedYear: string;
  onIndustry: (v: string) => void;
  onFoundedYear: (v: string) => void;
  options: CompanyOptions;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="flex flex-col gap-space-md">
      <label className={LABEL}>
        {t('industryLabel')}
        <select value={industry} onChange={(e) => onIndustry(e.target.value)} className={INPUT}>
          <option value="">{t('industryPlaceholder')}</option>
          {options.industries.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>
        <Hint>{t('industryHint')}</Hint>
      </label>
      <label className={LABEL}>
        {t('foundedLabel')}
        <input
          type="number"
          min={1800}
          max={2100}
          value={foundedYear}
          onChange={(e) => onFoundedYear(e.target.value)}
          className={`${INPUT} tnum max-w-40`}
        />
      </label>
    </div>
  );
}

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
          className={`${INPUT} tnum`}
        />
        <Hint>{amountHint}</Hint>
      </label>
      <label className={LABEL}>
        {t('currencyLabel')}
        <select value={currency} onChange={(e) => onCurrency(e.target.value)} className={`${INPUT} max-w-40`}>
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

export function ExperienceStep({
  amount,
  currency,
  count,
  onAmount,
  onCurrency,
  onCount,
}: {
  amount: string;
  currency: string;
  count: string;
  onAmount: (v: string) => void;
  onCurrency: (v: string) => void;
  onCount: (v: string) => void;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="flex flex-col gap-space-md">
      <MoneyStep
        amountLabel={t('experienceLabel')}
        amountHint={t('experienceHint')}
        amount={amount}
        currency={currency}
        onAmount={onAmount}
        onCurrency={onCurrency}
      />
      <label className={LABEL}>
        {t('experienceCountLabel')}
        <input
          type="number"
          min={0}
          value={count}
          onChange={(e) => onCount(e.target.value)}
          className={`${INPUT} tnum max-w-40`}
        />
      </label>
    </div>
  );
}

export function TeamStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('onboarding');
  return (
    <label className={LABEL}>
      {t('teamLabel')}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} tnum max-w-40`}
      />
    </label>
  );
}

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

export function MarketsStep({
  countries,
  keywords,
  onCountries,
  onKeywords,
  options,
}: {
  countries: string[];
  keywords: string[];
  onCountries: (v: string[]) => void;
  onKeywords: (v: string[]) => void;
  options: CompanyOptions;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="flex flex-col gap-space-md">
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-1 font-label-md text-label-md font-semibold text-on-surface">
          {t('countriesLabel')}
        </legend>
        {options.countries.map((c) => (
          <CheckboxRow
            key={c.code}
            id={`country-${c.code}`}
            label={`${c.name} (${c.code})`}
            checked={countries.includes(c.code)}
            onChange={() => onCountries(toggle(countries, c.code))}
          />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-1 font-label-md text-label-md font-semibold text-on-surface">
          {t('keywordsLabel')}
        </legend>
        <div className="thin-scroll flex max-h-52 flex-col overflow-y-auto rounded border border-outline-variant bg-surface-container-lowest px-space-sm py-space-xs">
          {options.keywords.map((k) => (
            <CheckboxRow
              dense
              key={k.key}
              id={`keyword-${k.key}`}
              label={k.label}
              checked={keywords.includes(k.key)}
              onChange={() => onKeywords(toggle(keywords, k.key))}
            />
          ))}
        </div>
        <Hint>{t('keywordsHint')}</Hint>
      </fieldset>
    </div>
  );
}

export function PermitsStep() {
  const t = useTranslations('onboarding');
  return (
    <div className="flex items-start gap-space-sm rounded border border-outline-variant bg-surface-container-low p-space-md">
      <Icon name="schedule" size="sm" className="mt-0.5 text-on-surface-variant" />
      <div className="flex flex-col gap-1">
        <p className="font-label-md text-label-md font-semibold text-on-surface">{t('permitsTitle')}</p>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('permitsBody')}</p>
      </div>
    </div>
  );
}
