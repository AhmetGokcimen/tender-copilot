'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { useFilterStore } from '@/stores/useFilterStore';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/brand/Logo';
import { buttonClass } from '@/components/ui/Button';
import type { CompanyPatch, CompanyProfile } from '@/lib/types';
import {
  CapacityStep,
  IdentityStep,
  OnboardingProgress,
  ReviewStep,
  SetupInterstitial,
  TenderPrefsStep,
  cuiValid,
} from '@/components/onboarding/steps';

interface Draft {
  name: string;
  cui: string;
  countries: string[];
  turnover: string;
  turnoverCurrency: string;
  capacity: string;
  certifications: string[];
  categories: string[];
  cpv: string[];
  manualCpv: string[];
  manual: boolean;
  blacklist: string[];
}

const str = (v: number | string | null | undefined): string =>
  v === null || v === undefined ? '' : String(v);

function fromCompany(company: CompanyProfile | undefined): Draft {
  return {
    name: company?.name ?? '',
    cui: company?.cui ?? '',
    countries: [...(company?.target_countries ?? [])],
    turnover: str(company?.annual_turnover),
    turnoverCurrency: company?.annual_turnover_currency ?? 'RON',
    capacity: str(company?.annual_capacity),
    certifications: [...(company?.certifications ?? [])],
    categories: company?.industry ? [company.industry] : [],
    cpv: [...(company?.cpv_codes ?? [])],
    manualCpv: [],
    manual: false,
    blacklist: [...(company?.blacklist_keywords ?? [])],
  };
}

/**
 * Resume step derived from saved data (works in both modes, survives tab
 * close): first step whose backend fields are still missing. Every Next
 * already saved its patch, so "left off" == "first incomplete".
 */
function derivedStep(company: CompanyProfile | undefined): number {
  if (!company || company.name.trim() === '') return 0;
  if (company.annual_turnover === null) return 1;
  if (!company.industry || company.cpv_codes.length === 0) return 2;
  return 3;
}

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const STEP_TITLES = ['stepIdentity', 'stepCapacity', 'stepTenders', 'stepReview'] as const;

function patchFor(step: number, draft: Draft): CompanyPatch | null {
  switch (step) {
    case 0:
      return { name: draft.name.trim(), cui: draft.cui.trim(), target_countries: draft.countries };
    case 1:
      return {
        annual_turnover: num(draft.turnover),
        annual_turnover_currency: draft.turnoverCurrency,
        annual_capacity: num(draft.capacity),
        certifications: draft.certifications,
      };
    case 2:
      return {
        industry: draft.categories[0],
        cpv_codes: [...draft.cpv].sort(),
        blacklist_keywords: draft.blacklist,
      };
    default:
      return null; // review confirms; every step already saved its patch
  }
}

function stepValid(step: number, draft: Draft): boolean {
  if (step === 0) return draft.name.trim().length > 0 && cuiValid(draft.cui);
  if (step === 1) return num(draft.turnover) !== null;
  if (step === 2) return draft.categories.length > 0 && draft.cpv.length > 0;
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

  if (!draft || !options) {
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

  const toggleCategory = (key: string) => {
    const removing = draft.categories.includes(key);
    const categories = removing
      ? draft.categories.filter((k) => k !== key)
      : [...draft.categories, key];
    const suggested = (k: string) =>
      options.industries.find((i) => i.key === k)?.suggested_cpv_codes ?? [];
    let cpv: string[];
    if (!removing) {
      cpv = [...new Set([...draft.cpv, ...suggested(key)])];
    } else {
      const stillSuggested = new Set(categories.flatMap(suggested));
      cpv = draft.cpv.filter((c) => stillSuggested.has(c) || draft.manualCpv.includes(c));
    }
    set({ categories, cpv });
  };

  const toggleCpv = (code: string) => {
    set({
      cpv: draft.cpv.includes(code)
        ? draft.cpv.filter((c) => c !== code)
        : [...draft.cpv, code],
    });
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
    const done = { onSuccess: () => go(step + 1) };
    if (!hasCompany) {
      createMut.mutate({ ...patch, name: draft.name.trim() }, done);
    } else {
      patchMut.mutate(patch, done);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface px-margin py-space-xl">
      {finishing && <SetupInterstitial />}
      <div className="flex w-full max-w-2xl flex-col gap-space-lg">
        <Link href="/" aria-label="Lichit home" className="self-start">
          <Logo />
        </Link>
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
              countries={draft.countries}
              onName={(name) => set({ name })}
              onCui={(cui) => set({ cui })}
              onCountries={(countries) => set({ countries })}
              options={options}
            />
          )}
          {step === 1 && (
            <CapacityStep
              turnover={draft.turnover}
              turnoverCurrency={draft.turnoverCurrency}
              capacity={draft.capacity}
              certifications={draft.certifications}
              onTurnover={(turnover) => set({ turnover })}
              onTurnoverCurrency={(turnoverCurrency) => set({ turnoverCurrency })}
              onCapacity={(capacity) => set({ capacity })}
              onCertifications={(certifications) => set({ certifications })}
            />
          )}
          {step === 2 && (
            <TenderPrefsStep
              categories={draft.categories}
              cpv={draft.cpv}
              manual={draft.manual}
              blacklist={draft.blacklist}
              onToggleCategory={toggleCategory}
              onToggleCpv={toggleCpv}
              onAddManualCpv={(code) =>
                set({
                  cpv: [...new Set([...draft.cpv, code])],
                  manualCpv: [...new Set([...draft.manualCpv, code])],
                })
              }
              onManual={(manual) => set({ manual })}
              onBlacklist={(blacklist) => set({ blacklist })}
              options={options}
            />
          )}
          {step === 3 && (
            <ReviewStep
              draft={draft}
              industryLabel={(key) => options.industries.find((i) => i.key === key)?.label ?? key}
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
              disabled={!stepValid(step, draft) || saving || finishing}
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
