'use client';

import { useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/Icon';
import { INPUT } from '@/components/ui/form';
import { CERTS, TRADES, certsFor, type Lang } from '@/lib/construction';
import { COUNTIES, eurRon, toRon } from '@/lib/fx';
import { credentialState, newId, type Credential, type TurnoverYear } from '@/lib/company-data';
import { MoneyInput, groupDigits } from '@/components/onboarding/steps';
import { RegionMap } from '@/components/onboarding/RegionMap';

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="font-label-md text-label-md font-semibold text-on-surface">
      {children}
    </label>
  );
}

export function Help({ children }: { children: React.ReactNode }) {
  return <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">{children}</span>;
}

/** Yes / No pill pair; null means not answered yet. */
export function YesNo({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const t = useTranslations('profile');
  return (
    <div className="flex flex-wrap items-center justify-between gap-space-sm">
      <span className="text-[14.5px] text-ink">{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-pill border border-line bg-raised p-0.5">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={clsx(
              'rounded-pill px-3.5 py-1 text-[13px] font-medium transition-colors',
              value === v ? 'bg-indigo text-on-indigo' : 'text-muted hover:text-ink',
            )}
          >
            {v ? t('yes') : t('no')}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DateInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`${INPUT} tnum !w-auto`}
    />
  );
}

/** Upload button that hands the picked file to the document agent. */
export function UploadButton({
  label,
  onFile,
  disabled,
  compact = false,
}: {
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-pill border border-dashed border-indigo/40 font-medium text-indigo-text transition-colors hover:border-indigo hover:bg-indigo-soft disabled:opacity-50',
          compact ? 'px-2.5 py-1 text-[12.5px]' : 'px-3.5 py-2 text-[13.5px]',
        )}
      >
        <Icon name="upload_file" size="sm" />
        {label}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Regions and roles                                                   */
/* ------------------------------------------------------------------ */

export function RegionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations('profile');
  const all = value.length === 0;
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={all}
          onClick={() => onChange([])}
          className={clsx(
            'rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors',
            all ? 'border-indigo bg-indigo text-on-indigo' : 'border-line bg-raised text-ink hover:border-indigo',
          )}
        >
          {t('wholeCountry')}
        </button>
        {COUNTIES.map((c) => {
          const on = value.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
              className={clsx(
                'rounded-pill border px-3 py-1.5 text-[13px] transition-colors',
                on ? 'border-indigo bg-indigo-soft font-medium text-indigo-text' : 'border-line bg-raised text-ink-2 hover:border-indigo',
              )}
            >
              {c}
            </button>
          );
        })}
      </div>
      <RegionMap value={value} onChange={onChange} />
    </div>
  );
}

const ROLES = [
  { key: 'solo', icon: 'person' },
  { key: 'consortium', icon: 'handshake' },
  { key: 'subcontractor', icon: 'call_split' },
] as const;

export function RolePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations('profile');
  return (
    <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-3">
      {ROLES.map((r) => {
        const on = value.includes(r.key);
        return (
          <button
            key={r.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== r.key) : [...value, r.key])}
            className={clsx(
              'flex flex-col items-start gap-1 rounded-lg border p-space-sm text-left transition-colors',
              on ? 'border-indigo bg-indigo-soft' : 'border-outline-variant bg-surface-container-lowest hover:border-indigo',
            )}
          >
            <Icon name={r.icon} size="md" className={on ? 'text-indigo-text' : 'text-on-surface-variant'} />
            <span className="text-[14px] font-medium text-ink">{t(`role_${r.key}`)}</span>
            <span className="text-[12.5px] leading-[17px] text-muted">{t(`role_${r.key}Hint`)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TradeChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const lang: Lang = useLocale() === 'ro' ? 'ro' : 'en';
  return (
    <div className="flex flex-wrap gap-1.5">
      {TRADES.map((tr) => {
        const on = value.includes(tr.key);
        return (
          <button
            key={tr.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== tr.key) : [...value, tr.key])}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] transition-colors',
              on ? 'border-indigo bg-indigo-soft font-medium text-indigo-text' : 'border-line bg-raised text-ink-2 hover:border-indigo',
            )}
          >
            <Icon name={tr.icon} size="xs" />
            {tr.name[lang]}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Turnover by year                                                    */
/* ------------------------------------------------------------------ */

export function TurnoverTable({
  years,
  rows,
  onChange,
}: {
  years: number[];
  rows: TurnoverYear[];
  onChange: (rows: TurnoverYear[]) => void;
}) {
  const t = useTranslations('profile');
  const byYear = new Map(rows.map((r) => [r.year, r]));
  const set = (year: number, patch: Partial<TurnoverYear>) => {
    const cur = byYear.get(year) ?? { year, amount: 0, currency: 'RON', source: 'manual' as const };
    // Editing a figure makes it the user's own; empty rows are dropped on save.
    const next = { ...cur, ...patch, source: patch.amount !== undefined ? ('manual' as const) : cur.source };
    onChange([...rows.filter((r) => r.year !== year), next]);
  };
  const filled = years.map((y) => byYear.get(y)).filter((r): r is TurnoverYear => Boolean(r && r.amount > 0));
  const inRon = filled.map((r) => toRon(r.amount, r.currency, r.year));
  const avg = filled.length && inRon.every((v) => v !== null) ? (inRon as number[]).reduce((a, b) => a + b, 0) / filled.length : null;
  const rate = eurRon(years[0]);
  return (
    <div className="flex flex-col gap-space-xs">
      {years.map((year) => {
        const row = byYear.get(year);
        return (
          <div key={year} className="flex flex-wrap items-center gap-space-sm">
            <span className="tnum w-12 text-[14px] font-medium text-ink">{year}</span>
            <MoneyInput
              id={`turnover-${year}`}
              value={row && row.amount > 0 ? String(Math.round(row.amount)) : ''}
              currency={row?.currency ?? 'RON'}
              onValue={(digits) => set(year, { amount: Number(digits || 0) })}
              onCurrency={(currency) => set(year, { currency, amount: row?.amount ?? 0 })}
            />
            {row && row.source !== 'manual' && (
              <span className="rounded-pill bg-indigo-soft px-2 py-0.5 text-[11.5px] font-medium text-indigo-text">
                {t(`source_${row.source}`)}
              </span>
            )}
          </div>
        );
      })}
      {avg !== null && (
        <p className="tnum mt-1 text-[13.5px] text-ink-2">
          {t('turnoverAverage', { years: filled.length })}: <strong>{groupDigits(String(Math.round(avg)))} RON</strong>
          {' · '}≈ {groupDigits(String(Math.round(avg / rate.rate)))} EUR
          <span className="text-muted"> ({t('bnrRate', { rate: rate.rate.toFixed(4) })}{rate.exact ? '' : '*'})</span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Authorizations and certifications                                   */
/* ------------------------------------------------------------------ */

const ANRE_CLASSES = ['A1', 'A2', 'A3', 'B', 'Bp', 'Be', 'Bi', 'C1A', 'C1B', 'C2A', 'C2B', 'D1', 'D2', 'E1', 'E2', 'EDIB', 'EDSB', 'PDIB', 'PDSB'];

export function ValidityBadge({ expires }: { expires: string | null }) {
  const t = useTranslations('profile');
  const state = credentialState({ expires_on: expires });
  if (state === 'unknown') return <span className="text-[12px] text-muted">{t('validityUnknown')}</span>;
  return (
    <span
      className={clsx(
        'rounded-pill px-2 py-0.5 text-[11.5px] font-semibold',
        state === 'expired' ? 'bg-risk-bg text-risk' : state === 'expiring' ? 'bg-warn-bg text-warn' : 'bg-eligible-bg text-eligible',
      )}
    >
      {t(`validity_${state}`)}
    </span>
  );
}

export function CredentialCard({
  cred,
  onChange,
  onRemove,
  onUpload,
  busy,
}: {
  cred: Credential;
  onChange: (c: Credential) => void;
  onRemove: () => void;
  onUpload: (file: File) => void;
  busy: boolean;
}) {
  const t = useTranslations('profile');
  const lang: Lang = useLocale() === 'ro' ? 'ro' : 'en';
  const meta = CERTS[cred.kind];
  const set = (patch: Partial<Credential>) => onChange({ ...cred, ...patch });
  const isAnre = cred.kind.startsWith('anre');
  return (
    <div className="chip-in flex flex-col gap-space-sm rounded-lg border border-indigo/25 bg-raised p-space-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14.5px] font-medium text-ink">{cred.name}</p>
          {meta && <p className="text-[12.5px] text-muted">{meta.issuer} · {meta.what[lang]}</p>}
        </div>
        <div className="flex items-center gap-2">
          <ValidityBadge expires={cred.expires_on} />
          <button type="button" onClick={onRemove} aria-label={t('remove')} className="rounded-full p-1 text-muted hover:bg-sunk hover:text-ink">
            <Icon name="close" size="sm" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {cred.category === 'certification' ? t('credStandard') : t('credClass')}
          <input
            list={isAnre ? 'anre-classes' : undefined}
            value={cred.type_class ?? ''}
            onChange={(e) => set({ type_class: e.target.value || null })}
            placeholder={isAnre ? 'B, C2A, EDIB…' : ''}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('credNumber')}
          <input value={cred.number ?? ''} onChange={(e) => set({ number: e.target.value || null })} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('credIssued')}
          <DateInput value={cred.issued_on} onChange={(v) => set({ issued_on: v })} />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('credExpires')}
          <DateInput value={cred.expires_on} onChange={(v) => set({ expires_on: v })} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-muted">
          {cred.source === 'document' ? t('credFromDocument') : t('credManual')}
        </span>
        <UploadButton label={t('credUpload')} onFile={onUpload} disabled={busy} compact />
      </div>
      <datalist id="anre-classes">
        {ANRE_CLASSES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}

export const blankCredential = (kind: string, category: Credential['category'], name: string): Credential => ({
  id: newId(),
  category,
  kind,
  name,
  type_class: null,
  number: null,
  issuer: CERTS[kind]?.issuer ?? null,
  holder: null,
  scope: null,
  issued_on: null,
  expires_on: null,
  document_id: null,
  source: 'manual',
});

/** Authorizations suggested for the trades, then the ISO list, each addable. */
export function CredentialsEditor({
  trades,
  creds,
  onChange,
  onUpload,
  busy,
}: {
  trades: string[];
  creds: Credential[];
  onChange: (c: Credential[]) => void;
  onUpload: (file: File, target: Credential | null) => void;
  busy: boolean;
}) {
  const t = useTranslations('profile');
  const lang: Lang = useLocale() === 'ro' ? 'ro' : 'en';
  const suggested = certsFor(trades);
  const authKinds = suggested.filter((c) => !c.key.startsWith('iso'));
  const isoKinds = suggested.filter((c) => c.key.startsWith('iso'));
  const has = (kind: string) => creds.some((c) => c.kind === kind);
  const add = (kind: string, category: Credential['category'], name: string) =>
    onChange([...creds, blankCredential(kind, category, name)]);
  const update = (c: Credential) => onChange(creds.map((x) => (x.id === c.id ? c : x)));
  const remove = (id: string) => onChange(creds.filter((x) => x.id !== id));

  const section = (category: Credential['category'], options: typeof suggested, title: string, hint: string) => (
    <div className="flex flex-col gap-space-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-label-md text-label-md font-semibold text-on-surface">{title}</span>
        <Help>{hint}</Help>
      </div>
      {creds
        .filter((c) => c.category === category)
        .map((c) => (
          <CredentialCard
            key={c.id}
            cred={c}
            onChange={update}
            onRemove={() => remove(c.id)}
            onUpload={(f) => onUpload(f, c)}
            busy={busy}
          />
        ))}
      <div className="flex flex-wrap gap-1.5">
        {options
          .filter((o) => !has(o.key))
          .map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => add(o.key, category, o.name)}
              title={o.what[lang]}
              className="rounded-pill border border-line px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-indigo hover:text-indigo-text"
            >
              + {o.name}
            </button>
          ))}
        <button
          type="button"
          onClick={() => add('other', category, category === 'authorization' ? t('otherAuthorization') : t('otherCertification'))}
          className="rounded-pill border border-dashed border-line px-3 py-1.5 text-[13px] text-muted hover:border-indigo hover:text-indigo-text"
        >
          + {t('other')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-space-lg">
      {section('authorization', authKinds, t('authorizationsTitle'), t('authorizationsHint'))}
      {section('certification', isoKinds, t('certificationsTitle'), t('certificationsHint'))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile strength                                                    */
/* ------------------------------------------------------------------ */

export function StrengthMeter({ pct, missing }: { pct: number; missing: string[] }) {
  const t = useTranslations('profile');
  return (
    <div className="flex flex-col gap-space-xs rounded-lg border border-line bg-raised p-space-md">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-medium text-ink">{t('strength')}</span>
        <span className="tnum text-[22px] font-semibold text-indigo-text">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunk">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--ribbon-1),var(--ribbon-2),var(--ribbon-4))] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      {missing.length > 0 && (
        <p className="text-[12.5px] text-muted">
          {t('strengthMissing')}: {missing.map((m) => t(`strength_${m}`)).join(', ')}
        </p>
      )}
    </div>
  );
}
