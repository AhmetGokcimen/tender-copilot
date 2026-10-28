'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import {
  useAuthorizations,
  useCompany,
  useCompanyOptions,
  useCreateCompany,
  useOnboardingStatus,
  usePatchAuthorization,
  usePatchCompany,
} from '@/lib/queries';
import { Icon } from '@/components/Icon';
import type { CompanyPatch, CompanyProfile } from '@/lib/types';
import {
  AuthorizationsStep,
  BasicsStep,
  ExperienceStep,
  MarketsStep,
  MoneyStep,
  NameStep,
  TeamStep,
  type ReadinessDraft,
} from '@/components/onboarding/steps';

interface Draft {
  name: string;
  industry: string;
  foundedYear: string;
  turnover: string;
  turnoverCurrency: string;
  expValue: string;
  expCurrency: string;
  expCount: string;
  teamSize: string;
  countries: string[];
  keywords: string[];
}

const EMPTY_DRAFT: Draft = {
  name: '',
  industry: '',
  foundedYear: '',
  turnover: '',
  turnoverCurrency: 'RON',
  expValue: '',
  expCurrency: 'RON',
  expCount: '',
  teamSize: '',
  countries: [],
  keywords: [],
};

const str = (v: number | string | null | undefined): string =>
  v === null || v === undefined ? '' : String(v);

function fromCompany(company: CompanyProfile | undefined): Draft {
  if (!company) return { ...EMPTY_DRAFT, countries: [], keywords: [] };
  return {
    name: company.name,
    industry: company.industry ?? '',
    foundedYear: str(company.founded_year),
    turnover: str(company.annual_turnover),
    turnoverCurrency: company.annual_turnover_currency ?? 'RON',
    expValue: str(company.similar_experience_value),
    expCurrency: company.similar_experience_currency ?? 'RON',
    expCount: str(company.similar_experience_contract_count),
    teamSize: str(company.team_size),
    countries: [...company.target_countries],
    keywords: [...company.keywords],
  };
}

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const STEP_TITLES = [
  'stepName',
  'stepBasics',
  'stepTurnover',
  'stepExperience',
  'stepTeam',
  'stepMarkets',
  'stepReadiness',
] as const;

const STEP_REQUIRED = [true, true, true, false, false, false, false];

function patchFor(step: number, draft: Draft): CompanyPatch | null {
  switch (step) {
    case 0:
      return { name: draft.name.trim() };
    case 1: {
      const founded = num(draft.foundedYear);
      return { industry: draft.industry, ...(founded === null ? {} : { founded_year: founded }) };
    }
    case 2:
      return {
        annual_turnover: num(draft.turnover),
        annual_turnover_currency: draft.turnoverCurrency,
      };
    case 3: {
      const value = num(draft.expValue);
      const count = num(draft.expCount);
      return {
        ...(value === null
          ? {}
          : { similar_experience_value: value, similar_experience_currency: draft.expCurrency }),
        ...(count === null ? {} : { similar_experience_contract_count: count }),
      };
    }
    case 4: {
      const team = num(draft.teamSize);
      return team === null ? {} : { team_size: team };
    }
    case 5:
      return { target_countries: draft.countries, keywords: draft.keywords };
    default:
      return null; // permits placeholder saves nothing
  }
}

function stepValid(step: number, draft: Draft): boolean {
  if (step === 0) return draft.name.trim().length > 0;
  if (step === 1) return draft.industry !== '';
  if (step === 2) return num(draft.turnover) !== null;
  return true;
}

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const router = useRouter();
  const companyQuery = useCompany();
  const { data: options } = useCompanyOptions();
  const { data: status } = useOnboardingStatus();
  const authQuery = useAuthorizations();
  const createMut = useCreateCompany();
  const patchMut = usePatchCompany();
  const authMut = usePatchAuthorization();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [authDraft, setAuthDraft] = useState<Record<string, ReadinessDraft>>({});

  useEffect(() => {
    if (draft || !(companyQuery.isFetched || status)) return;
    setDraft(fromCompany(companyQuery.data));
  }, [draft, companyQuery.isFetched, companyQuery.data, status]);

  // Step-7 rows: union of picked targets and already-opened rows. Merges
  // additively so going back to edit markets never wipes typed notes.
  const codes = [
    ...new Set([
      ...(companyQuery.data?.target_countries ?? []),
      ...(authQuery.data ?? []).map((r) => r.country_code),
    ]),
  ].sort();
  useEffect(() => {
    setAuthDraft((prev) => {
      const nextDraft = { ...prev };
      let changed = false;
      for (const code of codes) {
        if (!nextDraft[code]) {
          const row = (authQuery.data ?? []).find((r) => r.country_code === code);
          nextDraft[code] = { status: row?.status ?? 'not_started', notes: row?.requirement_notes ?? '' };
          changed = true;
        }
      }
      return changed ? nextDraft : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyQuery.data, authQuery.data]);

  useEffect(() => {
    createMut.reset();
    patchMut.reset();
    authMut.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Authorizations are NOT part of this gate: step 7 is optional, and a slow
  // or failing readiness fetch must never lock the whole wizard. Step 7
  // renders rows from target countries immediately and merges saved states
  // in when (and if) they arrive.
  if (!draft || !options) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-margin">
        <p className="font-body-md text-body-md text-on-surface-variant">{tc('loading')}</p>
      </div>
    );
  }

  const hasCompany = (status?.company_id ?? companyQuery.data?.id) != null;
  const saving = createMut.isPending || patchMut.isPending || authMut.isPending;
  const saveError = createMut.error ?? patchMut.error ?? authMut.error;
  const last = step === STEP_TITLES.length - 1;
  const set = (slice: Partial<Draft>) => setDraft({ ...draft, ...slice });

  const next = () => {
    if (step === STEP_TITLES.length - 1) {
      const changed = codes.filter((code) => {
        const row = (authQuery.data ?? []).find((r) => r.country_code === code);
        const slice = authDraft[code] ?? { status: 'not_started', notes: '' };
        return (
          row?.status !== slice.status || (row?.requirement_notes ?? '') !== slice.notes
        );
      });
      Promise.all(
        changed.map((code) => {
          const slice = authDraft[code] ?? { status: 'not_started' as const, notes: '' };
          return authMut.mutateAsync({
            code,
            patch: { status: slice.status, requirement_notes: slice.notes || null },
          });
        }),
      )
        .then(() => router.push('/app'))
        .catch(() => undefined);
      return;
    }
    const patch = patchFor(step, draft);
    if (patch === null) {
      router.push('/app');
      return;
    }
    const done = { onSuccess: () => setStep((s) => s + 1) };
    if (!hasCompany) {
      createMut.mutate({ ...patch, name: draft.name.trim() }, done);
    } else {
      patchMut.mutate(patch, done);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface px-margin py-space-xl">
      <div className="flex w-full max-w-2xl flex-col gap-space-lg">
        <header className="flex flex-col gap-space-xs">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            {t('title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
        </header>

        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <span className="tnum font-label-md text-label-md font-semibold text-on-surface-variant">
              {t('stepOf', { current: step + 1, total: STEP_TITLES.length })}
            </span>
            <span
              className={
                STEP_REQUIRED[step]
                  ? 'rounded bg-navy px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-white'
                  : 'rounded bg-surface-container-high px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-on-surface-variant'
              }
            >
              {STEP_REQUIRED[step] ? t('requiredBadge') : t('optionalBadge')}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-navy"
              style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
            />
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t(STEP_TITLES[step])}
          </h2>
        </div>

        <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          {step === 0 && <NameStep value={draft.name} onChange={(name) => set({ name })} />}
          {step === 1 && (
            <BasicsStep
              industry={draft.industry}
              foundedYear={draft.foundedYear}
              onIndustry={(industry) => set({ industry })}
              onFoundedYear={(foundedYear) => set({ foundedYear })}
              options={options}
            />
          )}
          {step === 2 && (
            <MoneyStep
              amountLabel={t('turnoverLabel')}
              amountHint={t('turnoverHint')}
              amount={draft.turnover}
              currency={draft.turnoverCurrency}
              onAmount={(turnover) => set({ turnover })}
              onCurrency={(turnoverCurrency) => set({ turnoverCurrency })}
            />
          )}
          {step === 3 && (
            <ExperienceStep
              amount={draft.expValue}
              currency={draft.expCurrency}
              count={draft.expCount}
              onAmount={(expValue) => set({ expValue })}
              onCurrency={(expCurrency) => set({ expCurrency })}
              onCount={(expCount) => set({ expCount })}
            />
          )}
          {step === 4 && <TeamStep value={draft.teamSize} onChange={(teamSize) => set({ teamSize })} />}
          {step === 5 && (
            <MarketsStep
              countries={draft.countries}
              keywords={draft.keywords}
              onCountries={(countries) => set({ countries })}
              onKeywords={(keywords) => set({ keywords })}
              options={options}
            />
          )}
          {step === 6 && (
            <>
              {authQuery.isError && (
                <div className="flex items-start gap-space-sm rounded border border-outline-variant bg-surface-container-low p-space-md">
                  <Icon name="info" size="sm" className="mt-0.5 shrink-0 text-navy" />
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {t('authLoadError')}
                  </p>
                </div>
              )}
              {authQuery.isPending && (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('authLoading')}
                </p>
              )}
              <AuthorizationsStep
                codes={codes}
                drafts={authDraft}
                onChange={(code, slice) =>
                  setAuthDraft((prev) => {
                    const existing = prev[code] ?? { status: 'not_started' as const, notes: '' };
                    return { ...prev, [code]: { ...existing, ...slice } };
                  })
                }
                countryName={(code) => options.countries.find((c) => c.code === code)?.name ?? code}
              />
            </>
          )}

          {saveError && (
            <p className="flex items-start gap-space-xs font-body-md text-body-md text-error">
              <Icon name="error" size="sm" className="mt-0.5" />
              <span>
                {t('errorTitle')} {saveError.message}
              </span>
            </p>
          )}

          <div className="flex items-center gap-space-md pt-space-xs">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0 || saving}
              className="inline-flex h-10 items-center rounded border border-outline-variant px-space-md font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
            >
              {t('back')}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!stepValid(step, draft) || saving}
              className="inline-flex h-10 items-center gap-space-sm rounded bg-navy px-space-lg font-label-md text-label-md font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              {saving ? t('saving') : last ? t('finish') : t('next')}
            </button>
            {(status?.complete || last) && (
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
