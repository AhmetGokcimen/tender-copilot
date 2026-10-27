'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthorizations, useCompanyOptions, usePatchAuthorization } from '@/lib/queries';
import type { AuthorizationStatus } from '@/lib/types';
import { AuthorizationRow } from '@/components/AuthorizationRow';
import { Icon } from '@/components/Icon';

/**
 * Company Settings management section for country authorizations.
 * Edits stay local until Save; only changed rows are PATCHed.
 */
export function AuthorizationsSection() {
  const t = useTranslations('authorization');
  const tc = useTranslations('common');
  const { data: rows } = useAuthorizations();
  const { data: options } = useCompanyOptions();
  const mut = usePatchAuthorization();
  const [draft, setDraft] = useState<Record<string, { status: AuthorizationStatus; notes: string }> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!draft && rows) {
      setDraft(
        Object.fromEntries(
          rows.map((r) => [r.country_code, { status: r.status, notes: r.requirement_notes ?? '' }]),
        ),
      );
    }
  }, [draft, rows]);

  if (!rows || !draft || !options) {
    return (
      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('settingsTitle')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{tc('loading')}</p>
      </section>
    );
  }

  const save = () => {
    const changed = rows.filter((r) => {
      const slice = draft[r.country_code];
      return slice && (slice.status !== r.status || slice.notes !== (r.requirement_notes ?? ''));
    });
    Promise.all(
      changed.map((r) =>
        mut.mutateAsync({
          code: r.country_code,
          patch: {
            status: draft[r.country_code].status,
            requirement_notes: draft[r.country_code].notes || null,
          },
        }),
      ),
    )
      .then(() => setSaved(true))
      .catch(() => undefined);
  };

  return (
    <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('settingsTitle')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('settingsBody')}</p>
      </div>
      {rows.map((r) => (
        <AuthorizationRow
          key={r.country_code}
          code={r.country_code}
          label={`${options.countries.find((c) => c.code === r.country_code)?.name ?? r.country_code} (${r.country_code})`}
          status={draft[r.country_code]?.status ?? r.status}
          notes={draft[r.country_code]?.notes ?? ''}
          onStatus={(status) =>
            setDraft((prev) => ({
              ...prev!,
              [r.country_code]: { status, notes: prev![r.country_code]?.notes ?? '' },
            }))
          }
          onNotes={(notes) =>
            setDraft((prev) => ({
              ...prev!,
              [r.country_code]: { status: prev![r.country_code]?.status ?? r.status, notes },
            }))
          }
        />
      ))}
      {mut.error && (
        <p className="flex items-start gap-space-xs font-body-md text-body-md text-error">
          <Icon name="error" size="sm" className="mt-0.5" />
          {mut.error.message}
        </p>
      )}
      <div className="flex items-center gap-space-md">
        <button
          type="button"
          onClick={save}
          disabled={mut.isPending}
          className="inline-flex h-9 items-center gap-space-xs rounded bg-navy px-space-md font-label-md text-label-md text-white hover:bg-navy-deep disabled:opacity-50"
        >
          <Icon name="save" size="sm" />
          {mut.isPending ? t('saving') : tc('save')}
        </button>
        {saved && !mut.isPending && (
          <span className="flex items-center gap-1 font-body-md text-body-md text-navy">
            <Icon name="check_circle" size="sm" />
            {tc('saved')}
          </span>
        )}
      </div>
    </section>
  );
}
