'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import {
  useCompany,
  useCompanyOptions,
  useCreateCompany,
  useOnboardingStatus,
  usePatchCompany,
} from '@/lib/queries';
import { USE_MOCK } from '@/lib/api';
import { getMockSession } from '@/lib/mock-auth';
import { getToken } from '@/lib/auth';
import { useFilterStore } from '@/stores/useFilterStore';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/brand/Logo';
import { buttonClass } from '@/components/ui/Button';
import type { CompanyPatch, CompanyProfile } from '@/lib/types';
import { scanCompanySite } from '@/lib/actions/site-scan';
import {
  FinanceStep,
  ScanBanner,
  SiteScanOverlay,
  type ScanView,
  IdentityStep,
  OnboardingProgress,
  ReviewStep,
  SetupInterstitial,
  TeamStep,
  TradeStep,
  cuiValid,
  websiteValid,
} from '@/components/onboarding/steps';
import { TRADES, workByCpv } from '@/lib/construction';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

interface Draft {
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

const str = (v: number | string | null | undefined): string =>
  v === null || v === undefined ? '' : String(Math.round(Number(v)));

function fromCompany(company: CompanyProfile | undefined): Draft {
  return {
    name: company?.name ?? '',
    cui: company?.cui ?? '',
    website: company?.website ?? '',
    countries: [...(company?.target_countries ?? [])],
    trades: [...(company?.subsectors ?? [])],
    // Only codes from the construction catalogue carry over.
    cpv: (company?.cpv_codes ?? []).filter((c) => workByCpv(c)),
    blacklist: [...(company?.blacklist_keywords ?? [])],
    turnover: str(company?.annual_turnover),
    turnoverCurrency: company?.annual_turnover_currency ?? 'EUR',
    capacity: str(company?.annual_capacity),
    capacityCurrency: company?.annual_capacity_currency ?? company?.annual_turnover_currency ?? 'EUR',
    certifications: [...(company?.certifications ?? [])],
    teamEu: str(company?.team_eu_count),
    teamNonEu: str(company?.team_non_eu_count),
  };
}

/**
 * Resume step derived from saved data (works in both modes, survives tab
 * close): first step whose backend fields are still missing. Every Next
 * already saved its patch, so "left off" == "first incomplete".
 */
function derivedStep(company: CompanyProfile | undefined): number {
  if (!company || company.name.trim() === '') return 0;
  if ((company.subsectors ?? []).length === 0 || !company.cpv_codes.some((c) => workByCpv(c))) return 1;
  if (company.annual_turnover === null) return 2;
  if (company.team_eu_count == null && company.team_non_eu_count == null) return 3;
  return 4;
}

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const STEP_TITLES = ['stepIdentity', 'stepTrades', 'stepFinance', 'stepTeam', 'stepReview'] as const;

function patchFor(step: number, draft: Draft): CompanyPatch | null {
  switch (step) {
    case 0:
      return {
        name: draft.name.trim(),
        cui: draft.cui.trim(),
        website: draft.website.trim() || null,
        target_countries: draft.countries,
      };
    case 1:
      return {
        industry: 'construction',
        subsectors: draft.trades,
        cpv_codes: [...draft.cpv].sort(),
        blacklist_keywords: draft.blacklist,
      };
    case 2:
      return {
        annual_turnover: num(draft.turnover),
        annual_turnover_currency: draft.turnoverCurrency,
        annual_capacity: num(draft.capacity),
        annual_capacity_currency: draft.capacityCurrency,
        certifications: draft.certifications,
      };
    case 3: {
      const eu = num(draft.teamEu) ?? 0;
      const other = num(draft.teamNonEu) ?? 0;
      return { team_eu_count: eu, team_non_eu_count: other, team_size: eu + other };
    }
    default:
      return null; // review confirms; every step already saved its patch
  }
}

function stepValid(step: number, draft: Draft): boolean {
  if (step === 0) return draft.name.trim().length > 0 && cuiValid(draft.cui) && websiteValid(draft.website);
  if (step === 1) return draft.trades.length > 0 && draft.cpv.length > 0;
  if (step === 2) return num(draft.turnover) !== null;
  if (step === 3) return (num(draft.teamEu) ?? 0) + (num(draft.teamNonEu) ?? 0) > 0;
  return true;
}

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const router = useRouter();
  const companyQuery = useCompany();
  const { data: options } = useCompanyOptions();
  const { data: status } = useOnboardingStatus();
  const createMut = useCreateCompany();
  const patchMut = usePatchCompany();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [finishing, setFinishing] = useState(false);
  const locale = useLocale() === 'ro' ? 'ro' : 'en';
  // Website agent: overlay state, the site last read, and what it suggested.
  const [scan, setScan] = useState<ScanView | null>(null);
  const [scannedSite, setScannedSite] = useState('');
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  const [scanSummary, setScanSummary] = useState({ host: '', summary: '' });
  // Signed-in users only: a mock session (mock mode) or a token (real mode).
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    const ok = USE_MOCK ? getMockSession() !== null : getToken() !== null;
    setAllowed(ok);
    if (!ok) router.replace('/auth/login');
  }, [router]);

  // Init only once the company fetch settled: the resume step is derived
  // from profile data, and status (100ms) wins the race against company
  // (150ms) in mock mode — deriving early would land on step 0 with an
  // empty draft. company-less users get data === undefined → step 0.
  useEffect(() => {
    if (draft || !companyQuery.isFetched) return;
    const next = fromCompany(companyQuery.data);
    // Fresh signup: prefill the company name entered on the signup form.
    if (USE_MOCK && next.name === '') {
      const session = getMockSession();
      if (session?.company) next.name = session.company;
    }
    setDraft(next);
    setStep(derivedStep(companyQuery.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, companyQuery.isFetched, companyQuery.data, status]);

  useEffect(() => {
    createMut.reset();
    patchMut.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!allowed || !draft || !options) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
        <p className="font-body-md text-body-md text-on-surface-variant">{tc('loading')}</p>
      </div>
    );
  }

  const hasCompany = (status?.company_id ?? companyQuery.data?.id) != null;
  const saving = createMut.isPending || patchMut.isPending;
  const saveError = createMut.error ?? patchMut.error;
  const last = step === STEP_TITLES.length - 1;
  const set = (slice: Partial<Draft>) => setDraft({ ...draft, ...slice });

  const toggleTrade = (key: string) => {
    if (draft.trades.includes(key)) {
      const trades = draft.trades.filter((k) => k !== key);
      // Drop works that only this trade offered.
      const kept = new Set(TRADES.filter((tr) => trades.includes(tr.key)).flatMap((tr) => tr.works.map((w) => w.cpv)));
      set({ trades, cpv: draft.cpv.filter((c) => kept.has(c)) });
    } else {
      set({ trades: [...draft.trades, key] });
    }
  };

  const toggleCpv = (code: string, tradeKey: string) => {
    const picked = draft.cpv.includes(code);
    set({
      cpv: picked ? draft.cpv.filter((c) => c !== code) : [...draft.cpv, code],
      // Picking a work from search also selects its trade.
      trades: picked || draft.trades.includes(tradeKey) ? draft.trades : [...draft.trades, tradeKey],
    });
  };

  /** Reads the site, preselects what it found, then moves to the trades step. */
  const runScan = async (site: string) => {
    const host = site.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    setScan({ phase: 'running', host });
    setScannedSite(site);
    const started = Date.now();
    const result = await scanCompanySite(site, locale).catch(() => ({ status: 'unreachable' as const }));
    // Let the progress read as work rather than a flash.
    await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (Date.now() - started))));
    if (result.status !== 'ok' || result.picks.length === 0) {
      setScan({ phase: 'failed', host, reason: result.status === 'ok' ? 'none' : result.status });
      return;
    }
    const tradesFound = [...new Set(result.picks.map((p) => p.trade))];
    setDraft((d) =>
      d && {
        ...d,
        trades: [...new Set([...d.trades, ...tradesFound])],
        cpv: [...new Set([...d.cpv, ...result.picks.map((p) => p.cpv)])],
      },
    );
    setSuggested(Object.fromEntries(result.picks.map((p) => [p.cpv, p.evidence])));
    setScanSummary({ host, summary: result.summary });
    setScan({ phase: 'done', host, pages: result.pages.length, works: result.picks.length, trades: tradesFound.length });
    window.setTimeout(() => {
      setScan(null);
      go(1);
    }, 1600);
  };

  const clearSuggestions = () => {
    const picked = new Set(Object.keys(suggested));
    set({ cpv: draft.cpv.filter((c) => !picked.has(c)) });
    setSuggested({});
  };

  const go = (nextStep: number) => {
    setDir(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const next = () => {
    if (last) {
      // Brief "setting up" beat, then the dashboard with the feed already
      // scoped to the first picked CPV division (existing filter control —
      // the user sees it and can clear it).
      setFinishing(true);
      window.setTimeout(() => {
        const first = [...draft.cpv].sort()[0];
        if (first) useFilterStore.getState().set({ cpv: first.slice(0, 2) });
        router.push('/app');
      }, 1600);
      return;
    }
    const patch = patchFor(step, draft);
    if (patch === null) {
      router.push('/app');
      return;
    }
    const site = draft.website.trim();
    const readSite = step === 0 && site !== '' && site !== scannedSite;
    const done = { onSuccess: () => (readSite ? runScan(site) : go(step + 1)) };
    if (!hasCompany) {
      createMut.mutate({ ...patch, name: draft.name.trim() }, done);
    } else {
      patchMut.mutate(patch, done);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface px-margin py-space-xl">
      {finishing && <SetupInterstitial />}
      {scan && (
        <SiteScanOverlay
          view={scan}
          onContinue={() => {
            setScan(null);
            go(1);
          }}
        />
      )}
      <div className="flex w-full max-w-3xl flex-col gap-space-lg">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Licits home">
            <Logo />
          </Link>
          <LanguageSwitcher />
        </div>
        <header className="flex flex-col gap-space-xs">
          <h1 className="text-[32px] font-light leading-[38px] tracking-[-1px] text-ink">
            {t('title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
        </header>

        <OnboardingProgress step={step} titles={STEP_TITLES.map((k) => t(k))} />
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          {t(STEP_TITLES[step])}
        </h2>

        <section
          key={step}
          className={`flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm ${dir >= 0 ? 'ob-enter-fwd' : 'ob-enter-back'}`}
        >
          {step === 0 && (
            <IdentityStep
              name={draft.name}
              cui={draft.cui}
              website={draft.website}
              countries={draft.countries}
              onName={(name) => set({ name })}
              onCui={(cui) => set({ cui })}
              onWebsite={(website) => set({ website })}
              onCountries={(countries) => set({ countries })}
              options={options}
            />
          )}
          {step === 1 && (
            <TradeStep
              trades={draft.trades}
              cpv={draft.cpv}
              blacklist={draft.blacklist}
              suggested={suggested}
              banner={
                Object.keys(suggested).length > 0 ? (
                  <ScanBanner
                    host={scanSummary.host}
                    summary={scanSummary.summary}
                    count={draft.cpv.filter((c) => c in suggested).length}
                    onClear={clearSuggestions}
                  />
                ) : undefined
              }
              onToggleTrade={toggleTrade}
              onToggleCpv={toggleCpv}
              onBlacklist={(blacklist) => set({ blacklist })}
            />
          )}
          {step === 2 && (
            <FinanceStep
              trades={draft.trades}
              turnover={draft.turnover}
              turnoverCurrency={draft.turnoverCurrency}
              capacity={draft.capacity}
              capacityCurrency={draft.capacityCurrency}
              certifications={draft.certifications}
              onTurnover={(turnover) => set({ turnover })}
              onTurnoverCurrency={(turnoverCurrency) => set({ turnoverCurrency })}
              onCapacity={(capacity) => set({ capacity })}
              onCapacityCurrency={(capacityCurrency) => set({ capacityCurrency })}
              onCertifications={(certifications) => set({ certifications })}
            />
          )}
          {step === 3 && (
            <TeamStep
              eu={draft.teamEu}
              nonEu={draft.teamNonEu}
              onEu={(teamEu) => set({ teamEu })}
              onNonEu={(teamNonEu) => set({ teamNonEu })}
            />
          )}
          {step === 4 && (
            <ReviewStep
              draft={draft}
              countryName={(code) => options.countries.find((c) => c.code === code)?.name ?? code}
              onJump={go}
            />
          )}

          {saveError && (
            <p className="flex items-start gap-space-xs font-body-md text-body-md text-error">
              <Icon name="error" size="sm" className="mt-0.5" />
              <span>
                {t('errorTitle')} {saveError.message}
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
              disabled={!stepValid(step, draft) || saving || finishing || scan !== null}
              data-assistant="ob-next"
              className={buttonClass()}
            >
              {saving ? t('saving') : last ? t('confirm') : t('next')}
            </button>
            {(status?.complete || last) && !finishing && (
              <Link
                href="/app"
                className="ml-auto font-body-md text-body-md text-on-surface-variant hover:underline"
              >
                {t('skipToDashboard')}
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
