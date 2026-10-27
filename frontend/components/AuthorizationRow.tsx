'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AuthorizationStatus } from '@/lib/types';
import { useCountryRequirements } from '@/lib/queries';
import { Icon } from '@/components/Icon';

const STATUSES: AuthorizationStatus[] = ['not_started', 'in_progress', 'obtained'];

/**
 * One country readiness row: status select + notes + expandable reference
 * text. Shared by the onboarding wizard (step 7) and Company Settings.
 * Guidance loads lazily — only when the reader expands it.
 */
export function AuthorizationRow({
  code,
  label,
  status,
  notes,
  onStatus,
  onNotes,
}: {
  code: string;
  label: string;
  status: AuthorizationStatus;
  notes: string;
  onStatus: (status: AuthorizationStatus) => void;
  onNotes: (notes: string) => void;
}) {
  const t = useTranslations('authorization');
  const [open, setOpen] = useState(false);
  const guide = useCountryRequirements(open ? code : null, open);

  const statusLabel =
    status === 'obtained'
      ? t('statusObtained')
      : status === 'in_progress'
        ? t('statusInProgress')
        : t('statusNotStarted');

  return (
    <div className="flex flex-col gap-space-sm border-t border-outline-variant pt-space-md first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-end gap-space-md">
        <span className="min-w-36 flex-1 font-label-md text-label-md font-semibold text-on-surface">
          {label}
        </span>
        <label className="flex flex-col gap-1 font-label-md text-label-md text-on-surface-variant">
          {t('statusLabel')}
          <select
            value={status}
            onChange={(e) => onStatus(e.target.value as AuthorizationStatus)}
            aria-label={`${label}: ${statusLabel}`}
            className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-space-xs font-body-md text-body-md text-on-surface outline-none focus:border-navy"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'obtained'
                  ? t('statusObtained')
                  : s === 'in_progress'
                    ? t('statusInProgress')
                    : t('statusNotStarted')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder={t('notesPlaceholder')}
        aria-label={`${label}: ${t('notesLabel')}`}
        className="h-9 w-full rounded border border-outline-variant bg-surface-container-lowest px-space-sm font-body-md text-body-md text-on-surface outline-none focus:border-navy"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-fit items-center gap-1 font-body-md text-body-md text-navy hover:underline"
      >
        <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" />
        {open ? t('lessInfo') : t('moreInfo')}
      </button>
      {open && (
        <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
          {guide.data ? guide.data.guidance : '…'}
        </p>
      )}
    </div>
  );
}
