'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useAuthorizationStore } from '@/stores/useAuthorizationStore';
import { useOnboardingStatus } from '@/lib/queries';
import { AuthorizationsSection } from '@/components/AuthorizationsSection';
import { Icon } from '@/components/Icon';

const INPUT =
  'h-10 w-full rounded border border-outline-variant bg-surface-container-lowest px-space-sm font-body-md text-body-md text-on-surface outline-none focus:border-navy focus:shadow-[0_0_0_3px_rgba(11,19,43,0.12)]';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const profile = useCompanyStore((s) => s.profile);
  const update = useCompanyStore((s) => s.update);
  const reset = useCompanyStore((s) => s.reset);
  const resetAuthorizations = useAuthorizationStore((s) => s.reset);
  const { data: obStatus } = useOnboardingStatus();

  const [draft, setDraft] = useState(() => ({
    name: profile.name,
    cui: profile.cui,
    cpv: profile.cpv_codes.join(', '),
    capacity: profile.annual_capacity === null ? '' : String(profile.annual_capacity),
    certifications: profile.certifications.join(', '),
    blacklist: profile.blacklist_keywords.join(', '),
  }));
  const [saved, setSaved] = useState(false);

  const save = () => {
    const split = (v: string) =>
      v.split(',').map((s) => s.trim()).filter(Boolean);
    update({
      name: draft.name.trim(),
      cui: draft.cui.trim(),
      cpv_codes: split(draft.cpv),
      annual_capacity: draft.capacity.trim() === '' ? null : Number(draft.capacity),
      certifications: split(draft.certifications),
      blacklist_keywords: split(draft.blacklist),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex max-w-3xl flex-col gap-space-lg">
      <header className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">{t('title')}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
      </header>

      {obStatus && !obStatus.complete && (
        <section className="flex items-center gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <Icon name="pending_actions" size="md" className="text-navy" />
          <div className="flex flex-1 flex-col gap-0.5">
            <h2 className="font-label-md text-label-md font-semibold text-on-surface">
              {t('onboardingTitle')}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{t('onboardingBody')}</p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex h-9 shrink-0 items-center rounded bg-navy px-space-md font-label-md text-label-md text-white hover:bg-navy-deep"
          >
            {t('onboardingCta')}
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('profileTitle')}</h2>
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
          <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
            {t('name')}
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
            {t('cui')}
            <input value={draft.cui} onChange={(e) => setDraft({ ...draft, cui: e.target.value })} className={`${INPUT} tnum`} />
          </label>
        </div>
        <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
          {t('capacity')}
          <input type="number" min={0} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} className={`${INPUT} tnum`} />
        </label>
        <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
          {t('certifications')}
          <input value={draft.certifications} onChange={(e) => setDraft({ ...draft, certifications: e.target.value })} className={INPUT} />
        </label>
      </section>

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('matchingTitle')}</h2>
        <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
          {t('cpv')}
          <input value={draft.cpv} onChange={(e) => setDraft({ ...draft, cpv: e.target.value })} className={`${INPUT} tnum`} />
        </label>
        <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
          {t('blacklist')}
          <input value={draft.blacklist} onChange={(e) => setDraft({ ...draft, blacklist: e.target.value })} className={INPUT} />
        </label>
      </section>

      <AuthorizationsSection />

      <div className="flex items-center gap-space-md">
        <button
          type="button"
          onClick={save}
          disabled={!draft.name.trim()}
          className="inline-flex h-9 items-center gap-space-xs rounded bg-navy px-space-md font-label-md text-label-md text-white hover:bg-navy-deep disabled:opacity-50"
        >
          <Icon name="save" size="sm" />
          {tc('save')}
        </button>
        {saved && (
          <span className="flex items-center gap-1 font-body-md text-body-md text-navy">
            <Icon name="check_circle" size="sm" />
            {t('saved')}
          </span>
        )}
        <button type="button" onClick={() => { reset(); resetAuthorizations(); window.location.reload(); }} className="ml-auto font-body-md text-body-md text-on-surface-variant hover:underline">
          Reset demo data
        </button>
      </div>
    </div>
  );
}
