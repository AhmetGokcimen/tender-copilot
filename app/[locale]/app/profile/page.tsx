'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { buttonClass } from '@/components/ui/Button';
import { INPUT } from '@/components/ui/form';
import { useDocumentAgent } from '@/components/agent/useDocumentAgent';
import { CountField, MoneyInput, groupDigits } from '@/components/onboarding/steps';
import {
  DateInput,
  FieldLabel,
  Help,
  StrengthMeter,
  TradeChips,
  UploadButton,
  ValidityBadge,
  YesNo,
} from '@/components/onboarding/profile-fields';
import { applyScannedDocument } from '@/lib/apply-document';
import {
  STAFF_ROLES,
  loadCompanyData,
  newId,
  profileStrength,
  removeDocument,
  saveCompany,
  saveContracts,
  saveCredentials,
  saveStaff,
  saveTurnover,
  type CompanyData,
  type Contract,
} from '@/lib/company-data';
import { syncLegacyProfile } from '@/lib/legacy-profile';

const SECTIONS = ['contracts', 'guarantees', 'staff', 'workload', 'exclusion', 'preferences', 'documents'] as const;

function Card({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[18px] font-medium text-ink">{title}</h2>
        {hint && <Help>{hint}</Help>}
      </div>
      {children}
    </section>
  );
}

function ContractRow({
  k,
  onChange,
  onRemove,
}: {
  k: Contract;
  onChange: (k: Contract) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('profile');
  const set = (patch: Partial<Contract>) => onChange({ ...k, ...patch });
  const limit = k.kind === 'services' ? 3 : 5;
  const old = k.end_year !== null && new Date().getFullYear() - k.end_year > limit;
  return (
    <div className="chip-in flex flex-col gap-space-sm rounded-lg border border-line bg-raised p-space-sm">
      <div className="flex items-start gap-2">
        <input
          value={k.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t('contractTitlePlaceholder')}
          className={`${INPUT} flex-1 font-medium`}
        />
        <button type="button" onClick={onRemove} aria-label={t('remove')} className="mt-2 rounded-full p-1 text-muted hover:bg-sunk hover:text-ink">
          <Icon name="close" size="sm" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('contractClient')}
          <input value={k.client ?? ''} onChange={(e) => set({ client: e.target.value || null })} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('contractKind')}
          <select value={k.kind} onChange={(e) => set({ kind: e.target.value as Contract['kind'] })} className={INPUT}>
            {(['works', 'services', 'supplies'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`kind_${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('contractEndYear')}
          <input
            inputMode="numeric"
            value={k.end_year ?? ''}
            onChange={(e) => set({ end_year: Number(e.target.value.replace(/\D/g, '').slice(0, 4)) || null })}
            className={`${INPUT} tnum`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2 sm:col-span-2">
          {t('contractValue')}
          <MoneyInput
            id={`k-${k.id}`}
            value={k.value ? String(Math.round(k.value)) : ''}
            currency={k.currency}
            onValue={(v) => set({ value: v ? Number(v) : null })}
            onCurrency={(currency) => set({ currency })}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('contractCountry')}
          <input value={k.country} onChange={(e) => set({ country: e.target.value.toUpperCase().slice(0, 2) })} className={`${INPUT} uppercase`} />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
          {t('contractRole')}
          <select value={k.role} onChange={(e) => set({ role: e.target.value as Contract['role'] })} className={INPUT}>
            {(['lead', 'subcontractor', 'partner'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`contractRole_${x}`)}
              </option>
            ))}
          </select>
        </label>
        {k.role !== 'lead' && (
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">
            {t('contractShare')}
            <input
              inputMode="numeric"
              value={k.share_pct ?? ''}
              onChange={(e) => set({ share_pct: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) || null })}
              className={`${INPUT} tnum`}
            />
          </label>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[12.5px] font-medium text-ink-2">{t('contractTrades')}</span>
        <TradeChips value={k.trades} onChange={(trades) => set({ trades })} />
      </div>
      <YesNo label={t('contractPv')} value={k.completion_certificate} onChange={(v) => set({ completion_certificate: v })} />
      {old && <p className="text-[12.5px] text-warn">{t('contractTooOld', { years: limit })}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const locale = useLocale() === 'ro' ? 'ro' : 'en';
  const [data, setData] = useState<CompanyData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docs = useDocumentAgent(data?.company.id || null, locale);

  useEffect(() => {
    loadCompanyData()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (!data) {
    return <p className="font-body-md text-body-md text-on-surface-variant">{error ?? tc('loading')}</p>;
  }
  const c = data.company;
  const set = (patch: Partial<CompanyData['company']>) => {
    setSaved(false);
    setData((d) => d && { ...d, company: { ...d.company, ...patch } });
  };
  const setContracts = (contracts: Contract[]) => {
    setSaved(false);
    setData((d) => d && { ...d, contracts });
  };
  const strength = profileStrength(data);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await saveCompany(c.id, c);
      await Promise.all([
        saveContracts(id, data.contracts.filter((k) => k.title.trim())),
        saveStaff(id, data.staff),
        saveCredentials(id, data.credentials),
        saveTurnover(id, data.turnover.filter((r) => r.amount > 0)),
      ]);
      await syncLegacyProfile(data).catch(() => undefined);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const scan = (file: File) =>
    docs.run(file, (doc, documentId) => {
      setSaved(false);
      setData((d) => d && applyScannedDocument(d, doc, documentId, null));
      // The upload added a document row; pick it up for the list below.
      loadCompanyData()
        .then((fresh) => fresh && setData((d) => d && { ...d, documents: fresh.documents }))
        .catch(() => undefined);
    });

  const money = (key: 'guarantee_limit' | 'credit_line' | 'cash_available' | 'ongoing_value', label: string) => (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor={`p-${key}`}>{label}</FieldLabel>
      <MoneyInput
        id={`p-${key}`}
        value={c[key] ? String(Math.round(c[key] as number)) : ''}
        currency={c.money_currency}
        onValue={(v) => set({ [key]: v ? Number(v) : null })}
        onCurrency={(money_currency) => set({ money_currency })}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-space-lg">
      {docs.stage}
      <header className="flex flex-wrap items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">{t('title')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-space-sm">
          <Link href="/onboarding" className={buttonClass({ variant: 'secondary' })}>
            <Icon name="edit" size="sm" />
            {t('editBasics')}
          </Link>
          <button type="button" onClick={save} disabled={saving} className={buttonClass()}>
            <Icon name={saved ? 'check' : 'save'} size="sm" />
            {saving ? t('saving') : saved ? t('saved') : t('save')}
          </button>
        </div>
      </header>
      {error && <p className="rounded-lg bg-risk-bg px-3 py-2 text-[13.5px] text-risk">{error}</p>}

      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-space-md lg:sticky lg:top-6 lg:self-start">
          <StrengthMeter pct={strength.pct} missing={strength.missing} />
          <nav className="hidden flex-col gap-0.5 lg:flex">
            {SECTIONS.map((s) => (
              <a key={s} href={`#${s}`} className="rounded-lg px-3 py-1.5 text-[14px] text-ink-2 hover:bg-sunk hover:text-ink">
                {t(`section_${s}`)}
              </a>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-space-lg">
          <Card id="contracts" title={t('section_contracts')} hint={t('contractsHint')}>
            {data.contracts.map((k) => (
              <ContractRow
                key={k.id}
                k={k}
                onChange={(next) => setContracts(data.contracts.map((x) => (x.id === k.id ? next : x)))}
                onRemove={() => setContracts(data.contracts.filter((x) => x.id !== k.id))}
              />
            ))}
            <div className="flex flex-wrap gap-space-sm">
              <button
                type="button"
                onClick={() =>
                  setContracts([
                    ...data.contracts,
                    {
                      id: newId(),
                      kind: 'works',
                      title: '',
                      client: null,
                      country: 'RO',
                      trades: [],
                      cpv_codes: [],
                      value: null,
                      currency: 'RON',
                      end_year: null,
                      completion_certificate: null,
                      role: 'lead',
                      share_pct: null,
                      document_id: null,
                    },
                  ])
                }
                className={buttonClass({ variant: 'secondary' })}
              >
                <Icon name="add" size="sm" />
                {t('addContract')}
              </button>
              <UploadButton label={t('contractUpload')} disabled={docs.busy} onFile={scan} />
            </div>
          </Card>

          <Card id="guarantees" title={t('section_guarantees')} hint={t('guaranteesHint')}>
            <div className="flex flex-wrap gap-1.5">
              {(['bank', 'insurance', 'cash'] as const).map((g) => {
                const on = c.guarantee_instruments.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        guarantee_instruments: on ? c.guarantee_instruments.filter((x) => x !== g) : [...c.guarantee_instruments, g],
                      })
                    }
                    className={clsx(
                      'rounded-pill border px-3 py-1.5 text-[13px] transition-colors',
                      on ? 'border-indigo bg-indigo-soft font-medium text-indigo-text' : 'border-line bg-raised text-ink-2 hover:border-indigo',
                    )}
                  >
                    {t(`guarantee_${g}`)}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-space-md sm:grid-cols-3">
              {money('guarantee_limit', t('guaranteeLimit'))}
              {money('credit_line', t('creditLine'))}
              {money('cash_available', t('cashAvailable'))}
            </div>
          </Card>

          <Card id="staff" title={t('section_staff')} hint={t('staffHint')}>
            <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
              {STAFF_ROLES.map((r) => (
                <CountField
                  key={r}
                  id={`staff-${r}`}
                  label={t(`staff_${r}`)}
                  hint=""
                  value={data.staff[r] === undefined ? '' : String(data.staff[r])}
                  onChange={(v) => {
                    setSaved(false);
                    setData((d) => d && { ...d, staff: { ...d.staff, [r]: v === '' ? 0 : Number(v) } });
                  }}
                />
              ))}
            </div>
          </Card>

          <Card id="workload" title={t('section_workload')} hint={t('workloadHint')}>
            <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
              {money('ongoing_value', t('ongoingValue'))}
              <div className="flex flex-col gap-1">
                <FieldLabel>{t('ongoingUntil')}</FieldLabel>
                <DateInput value={c.ongoing_until} onChange={(v) => set({ ongoing_until: v })} />
              </div>
            </div>
          </Card>

          <Card id="exclusion" title={t('section_exclusion')} hint={t('exclusionHint')}>
            <YesNo label={t('taxDebt')} value={c.tax_debt} onChange={(v) => set({ tax_debt: v })} />
            <YesNo label={t('insolvency')} value={c.insolvency} onChange={(v) => set({ insolvency: v })} />
            <YesNo label={t('pastTermination')} value={c.past_termination} onChange={(v) => set({ past_termination: v })} />
            {(c.tax_debt || c.insolvency || c.past_termination) && (
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-[13.5px] text-warn">{t('exclusionWarning')}</p>
            )}
          </Card>

          <Card id="preferences" title={t('section_preferences')}>
            <YesNo label={t('notifyEmail')} value={c.notify_email} onChange={(v) => set({ notify_email: v })} />
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <span className="text-[14.5px] text-ink">{t('notifyFrequency')}</span>
              <select
                value={c.notify_frequency}
                onChange={(e) => set({ notify_frequency: e.target.value as CompanyData['company']['notify_frequency'] })}
                className={`${INPUT} !w-auto`}
              >
                {(['instant', 'daily', 'weekly', 'off'] as const).map((f) => (
                  <option key={f} value={f}>
                    {t(`freq_${f}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <span className="text-[14.5px] text-ink">{t('minDays')}</span>
              <input
                inputMode="numeric"
                value={c.min_days_to_deadline}
                onChange={(e) => set({ min_days_to_deadline: Math.min(90, Number(e.target.value.replace(/\D/g, '')) || 0) })}
                className={`${INPUT} tnum !w-20 text-center`}
              />
            </div>
            <YesNo label={t('carInsurance')} value={c.has_car_insurance} onChange={(v) => set({ has_car_insurance: v })} />
            <YesNo label={t('liabilityInsurance')} value={c.has_liability_insurance} onChange={(v) => set({ has_liability_insurance: v })} />
            <YesNo label={t('swornTranslation')} value={c.sworn_translation} onChange={(v) => set({ sworn_translation: v })} />
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <span className="text-[14.5px] text-ink">{t('seapHistory')}</span>
              <select
                value={c.seap_history ?? ''}
                onChange={(e) => set({ seap_history: (e.target.value || null) as CompanyData['company']['seap_history'] })}
                className={`${INPUT} !w-auto`}
              >
                <option value="">—</option>
                {(['none', 'bid', 'won'] as const).map((f) => (
                  <option key={f} value={f}>
                    {t(`history_${f}`)}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card id="documents" title={t('section_documents')} hint={t('documentsHint')}>
            <div>
              <UploadButton label={t('docsUpload')} disabled={docs.busy} onFile={scan} />
            </div>
            {data.documents.length === 0 ? (
              <p className="text-[13.5px] text-muted">{t('noDocuments')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                {data.documents.map((doc) => {
                  const x = (doc.extracted ?? {}) as { expires_on?: string | null; number?: string | null; issued_on?: string | null };
                  return (
                    <li key={doc.id} className="flex flex-wrap items-center gap-space-sm px-3 py-2">
                      <Icon name="description" size="sm" className="text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-ink">{doc.file_name}</p>
                        <p className="text-[12px] text-muted">
                          {doc.doc_type ? t(`docType_${doc.doc_type}`) : t(`docStatus_${doc.status}`)}
                          {x.number ? ` · ${x.number}` : ''}
                          {x.issued_on ? ` · ${x.issued_on}` : ''}
                        </p>
                      </div>
                      {x.expires_on !== undefined && <ValidityBadge expires={x.expires_on ?? null} />}
                      <button
                        type="button"
                        aria-label={t('remove')}
                        onClick={async () => {
                          await removeDocument(doc).catch(() => undefined);
                          setData((d) => d && { ...d, documents: d.documents.filter((y) => y.id !== doc.id) });
                        }}
                        className="rounded-full p-1 text-muted hover:bg-sunk hover:text-ink"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <p className="tnum text-[12.5px] text-muted">
            {t('turnoverFootnote', {
              years: data.turnover
                .filter((r) => r.amount > 0)
                .sort((a, b) => b.year - a.year)
                .map((r) => `${r.year}: ${groupDigits(String(Math.round(r.amount)))} ${r.currency}`)
                .join(' · ') || '—',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
