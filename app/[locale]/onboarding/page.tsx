'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/brand/Logo';
import { buttonClass } from '@/components/ui/Button';
import { INPUT, LABEL } from '@/components/ui/form';
import { LanguageToggle } from '@/components/i18n/LanguageToggle';
import { AgentStage, type AgentFact } from '@/components/agent/AgentStage';
import { useDocumentAgent } from '@/components/agent/useDocumentAgent';
import {
  ChipInput,
  CountField,
  MoneyInput,
  OnboardingProgress,
  ScanBanner,
  SetupInterstitial,
  TradeStep,
  cuiValid,
  groupDigits,
  websiteValid,
} from '@/components/onboarding/steps';
import {
  CredentialsEditor,
  DateInput,
  FieldLabel,
  Help,
  RegionPicker,
  RolePicker,
  StrengthMeter,
  TradeChips,
  TurnoverTable,
  UploadButton,
  YesNo,
} from '@/components/onboarding/profile-fields';
import { lookupCompany } from '@/lib/actions/anaf';
import { getToken } from '@/lib/auth';
import { scanCompanySite } from '@/lib/actions/site-scan';
import { TRADES, workByCpv, type Lang } from '@/lib/construction';
import {
  credentialState,
  emptyCompany,
  loadCompanyData,
  profileStrength,
  saveCompany,
  saveCredentials,
  saveTurnover,
  turnoverYears,
  type CompanyData,
  type Credential,
} from '@/lib/company-data';
import { applyScannedDocument } from '@/lib/apply-document';
import { syncLegacyProfile } from '@/lib/legacy-profile';
import { useSession } from '@/lib/session';

const STEPS = ['stepCompany', 'stepWork', 'stepReach', 'stepFinance', 'stepCredentials', 'stepReadiness', 'stepReview'] as const;
const YEARS = turnoverYears();

/** First step whose required answers are still missing (resume point). */
function resumeStep(d: CompanyData): number {
  const c = d.company;
  if (!c.name || !c.cui) return 0;
  if (c.trades.length === 0 || !c.cpv_codes.some((x) => workByCpv(x))) return 1;
  if (c.roles.length === 0) return 2;
  if (!d.turnover.some((r) => r.amount > 0)) return 3;
  if (c.seap_registered === null) return 5;
  return 6;
}

function stepValid(step: number, d: CompanyData): boolean {
  const c = d.company;
  if (step === 0) return c.name.trim().length > 0 && cuiValid(c.cui ?? '') && websiteValid(c.website ?? '');
  if (step === 1) return c.trades.length > 0 && c.cpv_codes.length > 0;
  if (step === 2) return c.roles.length > 0;
  if (step === 3) return d.turnover.some((r) => r.amount > 0);
  if (step === 5)
    return (
      c.seap_registered !== null &&
      c.esignature !== null &&
      c.duae_experience !== null &&
      (c.team_eu ?? 0) + (c.team_non_eu ?? 0) > 0
    );
  return true;
}

const emptyData = (): CompanyData => ({
  company: emptyCompany(),
  turnover: [],
  credentials: [],
  contracts: [],
  staff: {},
  documents: [],
});

type AgentView = {
  kind: 'anaf' | 'site';
  subject: string;
  running: boolean;
  facts: AgentFact[];
  error?: string;
  note?: string;
};

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tp = useTranslations('profile');
  const ta = useTranslations('agent');
  const tc = useTranslations('common');
  const locale = useLocale() === 'ro' ? 'ro' : 'en';
  const lang: Lang = locale;
  const router = useRouter();
  const session = useSession();

  const [data, setData] = useState<CompanyData | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [agent, setAgent] = useState<AgentView | null>(null);
  const [scannedSite, setScannedSite] = useState('');
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  const [siteSummary, setSiteSummary] = useState({ host: '', summary: '' });
  const docs = useDocumentAgent(companyId, locale);

  useEffect(() => {
    if (session.status === 'out') router.replace('/auth/login');
    if (session.status !== 'in' || data) return;
    loadCompanyData()
      .then((d) => {
        const next = d ?? emptyData();
        if (!next.company.name && session.user.company) next.company.name = session.user.company;
        setData(next);
        setCompanyId(d?.company.id || null);
        setScannedSite(d?.company.website ?? '');
        setStep(d ? resumeStep(d) : 0);
      })
      .catch((e: Error) => {
        setError(e.message);
        setData(emptyData());
      });
  }, [session, data, router]);

  if (session.status !== 'in' || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
        <p className="font-body-md text-body-md text-on-surface-variant">{tc('loading')}</p>
      </div>
    );
  }

  const c = data.company;
  const set = (patch: Partial<CompanyData['company']>) =>
    setData((d) => d && { ...d, company: { ...d.company, ...patch } });
  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const last = step === STEPS.length - 1;

  /* ---------------- agents ---------------- */

  const runAnaf = async () => {
    const cui = (c.cui ?? '').trim();
    setAgent({ kind: 'anaf', subject: cui, running: true, facts: [] });
    const started = Date.now();
    const res = await lookupCompany(cui, YEARS, getToken()).catch(() => ({ status: 'unavailable' as const }));
    await new Promise((r) => setTimeout(r, Math.max(0, 2400 - (Date.now() - started))));
    if (res.status !== 'ok') {
      setAgent({ kind: 'anaf', subject: cui, running: false, facts: [], error: t(`anafFail_${res.status}`) });
      return;
    }
    const co = res.company;
    setData((d) => {
      if (!d) return d;
      const turnover = d.turnover.filter((r) => !res.turnover.some((x) => x.year === r.year));
      for (const x of res.turnover) turnover.push({ year: x.year, amount: x.amount, currency: 'RON', source: 'anaf' });
      return {
        ...d,
        turnover,
        company: {
          ...d.company,
          name: co.name || d.company.name,
          address: co.address,
          county: co.county,
          caen_main: co.caenMain,
          vat_payer: co.vatPayer,
          active: co.active,
          founded_year: co.foundedYear,
        },
      };
    });
    const facts: AgentFact[] = [{ label: t('anafName'), value: co.name }];
    if (co.county) facts.push({ label: t('anafCounty'), value: co.county });
    if (co.caenMain) facts.push({ label: 'CAEN', value: co.caenMain });
    if (co.foundedYear) facts.push({ label: t('anafFounded'), value: String(co.foundedYear) });
    if (co.vatPayer !== null) facts.push({ label: t('anafVat'), value: co.vatPayer ? tp('yes') : tp('no') });
    if (co.active !== null)
      facts.push({ label: t('anafActive'), value: co.active ? tp('yes') : tp('no'), tone: co.active ? 'ok' : 'risk' });
    for (const x of res.turnover)
      facts.push({ label: `${t('anafTurnover')} ${x.year}`, value: `${groupDigits(String(Math.round(x.amount)))} RON` });
    setAgent({ kind: 'anaf', subject: cui, running: false, facts, note: t('anafNote') });
  };

  const runSite = async (site: string) => {
    const host = site.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    setAgent({ kind: 'site', subject: host, running: true, facts: [] });
    setScannedSite(site);
    const started = Date.now();
    const result = await scanCompanySite(site, locale, getToken()).catch(() => ({ status: 'unreachable' as const }));
    await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (Date.now() - started))));
    if (result.status !== 'ok' || result.picks.length === 0) {
      const reason = result.status === 'ok' ? 'none' : result.status;
      setAgent({ kind: 'site', subject: host, running: false, facts: [], error: t(`scanFail_${reason}`) });
      return;
    }
    const tradesFound = [...new Set(result.picks.map((p) => p.trade))];
    setData(
      (d) =>
        d && {
          ...d,
          company: {
            ...d.company,
            trades: [...new Set([...d.company.trades, ...tradesFound])],
            cpv_codes: [...new Set([...d.company.cpv_codes, ...result.picks.map((p) => p.cpv)])],
          },
        },
    );
    setSuggested(Object.fromEntries(result.picks.map((p) => [p.cpv, p.evidence])));
    setSiteSummary({ host, summary: result.summary });
    const facts: AgentFact[] = tradesFound.map((k) => ({
      label: TRADES.find((x) => x.key === k)!.name[lang],
      value: t('worksPicked', { count: result.picks.filter((p) => p.trade === k).length }),
    }));
    setAgent({
      kind: 'site',
      subject: host,
      running: false,
      facts,
      note: t('scanFound', { works: result.picks.length, trades: tradesFound.length, pages: result.pages.length }),
    });
  };

  const closeAgent = () => {
    const wasSite = agent?.kind === 'site';
    setAgent(null);
    if (wasSite) go(1);
  };

  const scan = (file: File, target: Credential | null) =>
    docs.run(file, (doc, documentId) => setData((d) => d && applyScannedDocument(d, doc, documentId, target)));

  /* ---------------- saving ---------------- */

  const next = async () => {
    setSaving(true);
    setError(null);
    try {
      if (last) {
        const done = { ...c, onboarding_completed_at: new Date().toISOString() };
        const id = await saveCompany(companyId, done);
        await syncLegacyProfile({ ...data, company: { ...done, id } }).catch(() => undefined);
        setFinishing(true);
        window.setTimeout(() => router.push('/app'), 1500);
        return;
      }
      const id = await saveCompany(companyId, { ...c });
      if (!companyId) setCompanyId(id);
      if (step === 3) await saveTurnover(id, data.turnover.filter((r) => r.amount > 0));
      if (step === 4) await saveCredentials(id, data.credentials);
      const site = (c.website ?? '').trim();
      if (step === 0 && site && site !== scannedSite) {
        setSaving(false);
        await runSite(site);
        return;
      }
      go(step + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const strength = profileStrength(data);
  const expired = data.credentials.filter((x) => credentialState(x) === 'expired');
  const reviewRows: [string, string, number][] = [
    [t('reviewName'), `${c.name} · ${c.cui ?? ''}`, 0],
    ['CAEN', [c.caen_main, ...c.caen_secondary].filter(Boolean).join(', '), 0],
    [t('reviewWebsite'), c.website ?? '', 0],
    [t('reviewTrades'), TRADES.filter((x) => c.trades.includes(x.key)).map((x) => x.name[lang]).join(', '), 1],
    [t('reviewWorks'), t('worksPicked', { count: c.cpv_codes.length }), 1],
    [tp('rolesLabel'), c.roles.map((r) => tp(`role_${r}`)).join(', '), 2],
    [tp('regionsLabel'), c.regions.length ? c.regions.join(', ') : tp('wholeCountry'), 2],
    [
      tp('turnoverLabel'),
      [...data.turnover]
        .filter((r) => r.amount > 0)
        .sort((a, b) => b.year - a.year)
        .map((r) => `${r.year}: ${groupDigits(String(Math.round(r.amount)))} ${r.currency}`)
        .join(' · '),
      3,
    ],
    [tp('credentialsLabel'), data.credentials.map((x) => x.name + (x.type_class ? ` (${x.type_class})` : '')).join(', '), 4],
    [
      tp('seapTitle'),
      [
        `SEAP ${c.seap_registered ? '✓' : '✗'}`,
        `${tp('esignatureShort')} ${c.esignature ? '✓' : '✗'}`,
        `DUAE ${c.duae_experience ? '✓' : '✗'}`,
      ].join(' · '),
      5,
    ],
    [t('reviewTeam'), t('reviewTeamValue', { eu: c.team_eu ?? 0, other: c.team_non_eu ?? 0 }), 5],
  ];

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface px-margin py-space-xl">
      {finishing && <SetupInterstitial />}
      {agent && (
        <AgentStage
          icon={agent.kind === 'anaf' ? 'account_balance' : 'travel_explore'}
          title={agent.kind === 'anaf' ? t('anafTitle') : t('scanTitle')}
          subject={agent.subject}
          stages={
            agent.kind === 'anaf'
              ? [t('anafStageId'), t('anafStageBalance'), t('anafStageFill')]
              : [t('scanStageOpen'), t('scanStagePages'), t('scanStageMatch')]
          }
          running={agent.running}
          facts={agent.facts}
          note={agent.note}
          error={agent.error}
          onClose={closeAgent}
          closeLabel={agent.error && agent.kind === 'site' ? t('scanContinue') : ta('done')}
        />
      )}
      {docs.stage}

      <div className="flex w-full max-w-3xl flex-col gap-space-lg">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Licits home">
            <Logo />
          </Link>
          <LanguageToggle />
        </div>
        <header className="flex flex-col gap-space-xs">
          <h1 className="text-[32px] font-light leading-[38px] tracking-[-1px] text-ink">{t('title')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
        </header>

        <OnboardingProgress step={step} titles={STEPS.map((k) => t(k))} />
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t(STEPS[step])}</h2>

        <section
          key={step}
          className={`flex flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-sm ${dir >= 0 ? 'ob-enter-fwd' : 'ob-enter-back'}`}
        >
          {step === 0 && (
            <div className="flex flex-col gap-space-md">
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="ob-cui">{t('cuiLabel')}</FieldLabel>
                <div className="flex flex-wrap gap-space-xs">
                  <input
                    id="ob-cui"
                    value={c.cui ?? ''}
                    onChange={(e) => set({ cui: e.target.value.toUpperCase().replace(/\s/g, '') || null })}
                    placeholder={t('cuiPlaceholder')}
                    data-assistant="ob-cui"
                    className={`${INPUT} tnum !w-56`}
                  />
                  <button
                    type="button"
                    disabled={!cuiValid(c.cui ?? '')}
                    onClick={runAnaf}
                    className={buttonClass({ variant: 'secondary' })}
                  >
                    <Icon name="travel_explore" size="sm" />
                    {t('anafButton')}
                  </button>
                </div>
                <Help>{t('cuiAnafHint')}</Help>
              </div>
              <label className={LABEL}>
                {t('nameLabel')}
                <input
                  value={c.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder={t('namePlaceholder')}
                  data-assistant="ob-name"
                  className={INPUT}
                />
              </label>
              {(c.address || c.county) && (
                <p className="flex items-start gap-2 rounded-lg bg-sunk/60 px-3 py-2 text-[13.5px] text-ink-2">
                  <Icon name="location_on" size="sm" className="mt-0.5 text-muted" />
                  {[c.address, c.county].filter(Boolean).join(' · ')}
                  {c.founded_year ? ` · ${t('anafFounded')} ${c.founded_year}` : ''}
                </p>
              )}
              <div className="grid grid-cols-1 gap-space-md sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className={LABEL}>
                  {t('caenMainLabel')}
                  <input
                    value={c.caen_main ?? ''}
                    onChange={(e) => set({ caen_main: e.target.value.replace(/\D/g, '').slice(0, 4) || null })}
                    placeholder="4120"
                    className={`${INPUT} tnum`}
                  />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md font-semibold text-on-surface">{t('caenSecondaryLabel')}</span>
                  <ChipInput
                    values={c.caen_secondary}
                    onChange={(v) =>
                      set({ caen_secondary: v.map((x) => x.replace(/\D/g, '').slice(0, 4)).filter((x) => x.length === 4) })
                    }
                    placeholder={t('caenSecondaryPlaceholder')}
                  />
                </div>
              </div>
              <Help>{t('caenHint')}</Help>
              <label className={LABEL}>
                {t('websiteLabel')}
                <input
                  type="url"
                  inputMode="url"
                  value={c.website ?? ''}
                  onChange={(e) => set({ website: e.target.value || null })}
                  placeholder={t('websitePlaceholder')}
                  className={INPUT}
                />
                <Help>{websiteValid(c.website ?? '') ? t('websiteHint') : t('websiteError')}</Help>
              </label>
            </div>
          )}

          {step === 1 && (
            <TradeStep
              trades={c.trades}
              cpv={c.cpv_codes}
              blacklist={c.blacklist}
              suggested={suggested}
              banner={
                Object.keys(suggested).length > 0 ? (
                  <ScanBanner
                    host={siteSummary.host}
                    summary={siteSummary.summary}
                    count={c.cpv_codes.filter((x) => x in suggested).length}
                    onClear={() => {
                      set({ cpv_codes: c.cpv_codes.filter((x) => !(x in suggested)) });
                      setSuggested({});
                    }}
                  />
                ) : undefined
              }
              onToggleTrade={(key) => {
                if (c.trades.includes(key)) {
                  const trades = c.trades.filter((k) => k !== key);
                  const kept = new Set(
                    TRADES.filter((tr) => trades.includes(tr.key)).flatMap((tr) => tr.works.map((w) => w.cpv)),
                  );
                  set({ trades, cpv_codes: c.cpv_codes.filter((x) => kept.has(x)) });
                } else set({ trades: [...c.trades, key] });
              }}
              onToggleCpv={(code, tradeKey) => {
                const picked = c.cpv_codes.includes(code);
                set({
                  cpv_codes: picked ? c.cpv_codes.filter((x) => x !== code) : [...c.cpv_codes, code],
                  trades: picked || c.trades.includes(tradeKey) ? c.trades : [...c.trades, tradeKey],
                });
              }}
              onBlacklist={(blacklist) => set({ blacklist })}
            />
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-space-xs">
                <FieldLabel>{tp('rolesLabel')}</FieldLabel>
                <RolePicker value={c.roles} onChange={(roles) => set({ roles })} />
              </div>
              {(c.roles.includes('consortium') || c.roles.includes('solo')) && (
                <div className="flex flex-col gap-space-xs">
                  <FieldLabel>{tp('subcontractOutLabel')}</FieldLabel>
                  <Help>{tp('subcontractOutHint')}</Help>
                  <TradeChips value={c.subcontract_out} onChange={(subcontract_out) => set({ subcontract_out })} />
                </div>
              )}
              <div className="flex flex-col gap-space-xs">
                <FieldLabel>{tp('regionsLabel')}</FieldLabel>
                <Help>{tp('regionsHint')}</Help>
                <RegionPicker value={c.regions} onChange={(regions) => set({ regions })} />
              </div>
              <div className="grid grid-cols-1 gap-space-lg sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="ob-max">{tp('maxContractLabel')}</FieldLabel>
                  <MoneyInput
                    id="ob-max"
                    value={c.max_contract_value ? String(Math.round(c.max_contract_value)) : ''}
                    currency={c.max_contract_currency ?? 'RON'}
                    onValue={(v) => set({ max_contract_value: v ? Number(v) : null })}
                    onCurrency={(max_contract_currency) => set({ max_contract_currency })}
                  />
                  <Help>{tp('maxContractHint')}</Help>
                </div>
                <CountField
                  id="ob-concurrent"
                  label={tp('concurrentLabel')}
                  hint={tp('concurrentHint')}
                  value={c.concurrent_projects === null ? '' : String(c.concurrent_projects)}
                  onChange={(v) => set({ concurrent_projects: v === '' ? null : Number(v) })}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex flex-col gap-space-xs">
                <FieldLabel>{tp('turnoverLabel')}</FieldLabel>
                <Help>{tp('turnoverHint')}</Help>
                <TurnoverTable
                  years={YEARS}
                  rows={data.turnover}
                  onChange={(turnover) => setData((d) => d && { ...d, turnover })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-space-sm rounded-lg border border-dashed border-line p-space-sm">
                <Icon name="description" size="sm" className="text-muted" />
                <span className="flex-1 text-[13.5px] text-ink-2">{tp('balanceUploadHint')}</span>
                <UploadButton label={tp('balanceUpload')} disabled={docs.busy} onFile={(f) => scan(f, null)} />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="flex flex-wrap items-center gap-space-sm rounded-lg bg-indigo-soft/60 p-space-sm">
                <Icon name="document_scanner" size="sm" className="text-indigo-text" />
                <span className="flex-1 text-[13.5px] text-ink-2">{tp('docsHint')}</span>
                <UploadButton label={tp('docsUpload')} disabled={docs.busy} onFile={(f) => scan(f, null)} />
              </div>
              <CredentialsEditor
                trades={c.trades}
                creds={data.credentials}
                onChange={(credentials) => setData((d) => d && { ...d, credentials })}
                busy={docs.busy}
                onUpload={scan}
              />
              {expired.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-risk-bg px-3 py-2 text-[13.5px] text-risk">
                  <Icon name="warning" size="sm" className="mt-0.5" />
                  {tp('expiredWarning', { names: expired.map((x) => x.name).join(', ') })}
                </p>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <div className="flex flex-col gap-space-sm">
                <FieldLabel>{tp('seapTitle')}</FieldLabel>
                <YesNo label={tp('seapRegistered')} value={c.seap_registered} onChange={(v) => set({ seap_registered: v })} />
                <YesNo label={tp('esignature')} value={c.esignature} onChange={(v) => set({ esignature: v })} />
                {c.esignature && (
                  <div className="flex flex-wrap items-center justify-between gap-space-sm pl-space-md">
                    <span className="text-[13.5px] text-ink-2">{tp('esignatureExpires')}</span>
                    <DateInput value={c.esignature_expires_on} onChange={(v) => set({ esignature_expires_on: v })} />
                  </div>
                )}
                <YesNo label={tp('duae')} value={c.duae_experience} onChange={(v) => set({ duae_experience: v })} />
                {(c.seap_registered === false || c.esignature === false) && (
                  <p className="flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2 text-[13.5px] text-warn">
                    <Icon name="info" size="sm" className="mt-0.5" />
                    {tp('seapWarning')}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-space-md">
                <FieldLabel>{t('teamIntro')}</FieldLabel>
                <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                  <CountField
                    id="ob-team-eu"
                    label={t('teamEuLabel')}
                    hint={t('teamEuHint')}
                    value={c.team_eu === null ? '' : String(c.team_eu)}
                    onChange={(v) => set({ team_eu: v === '' ? null : Number(v) })}
                  />
                  <CountField
                    id="ob-team-noneu"
                    label={t('teamNonEuLabel')}
                    hint={t('teamNonEuHint')}
                    value={c.team_non_eu === null ? '' : String(c.team_non_eu)}
                    onChange={(v) => set({ team_non_eu: v === '' ? null : Number(v) })}
                  />
                </div>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <StrengthMeter pct={strength.pct} missing={strength.missing} />
              <dl className="flex flex-col">
                {reviewRows.map(([label, value, s]) => (
                  <div
                    key={label}
                    className="flex items-center gap-space-md border-b border-outline-variant py-space-xs last:border-b-0"
                  >
                    <dt className="w-40 shrink-0 font-label-md text-label-md text-on-surface-variant">{label}</dt>
                    <dd className="flex-1 font-body-md text-body-md text-on-surface">
                      {value || <span className="text-on-surface-variant">{t('reviewEmpty')}</span>}
                    </dd>
                    <dd>
                      <button
                        type="button"
                        onClick={() => go(s)}
                        className="font-body-sm text-body-sm font-medium text-indigo-text hover:underline"
                      >
                        {t('reviewEdit')}
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-[13.5px] text-ink-2">{tp('laterNote')}</p>
            </>
          )}

          {error && (
            <p className="flex items-start gap-space-xs font-body-md text-body-md text-error">
              <Icon name="error" size="sm" className="mt-0.5" />
              <span>
                {t('errorTitle')} {error}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
            <button
              type="button"
              onClick={() => go(step - 1)}
              disabled={step === 0 || saving || finishing}
              data-assistant="ob-back"
              className={buttonClass({ variant: 'secondary' })}
            >
              {t('back')}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!stepValid(step, data) || saving || finishing || agent !== null}
              data-assistant="ob-next"
              className={buttonClass()}
            >
              {saving ? t('saving') : last ? t('confirm') : t('next')}
            </button>
            {c.onboarding_completed_at && !finishing && (
              <Link href="/app" className="ml-auto font-body-md text-body-md text-on-surface-variant hover:underline">
                {t('skipToDashboard')}
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
