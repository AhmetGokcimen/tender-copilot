'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import type { AgentOutputs } from '@/lib/agents';

const STATUS_STYLE = {
  met: 'bg-success/15 text-success',
  not_met: 'bg-error/15 text-error',
  unclear: 'bg-surface-container-high text-on-surface-variant',
} as const;

/**
 * What the agents found but kept out of the submitted documents: how each
 * requirement checks out against the company, the risks, and what is still
 * missing before submission. Internal notes, in the interface language.
 */
export function ReviewPanel({ outputs }: { outputs: AgentOutputs }) {
  const t = useTranslations('review');
  const elig = outputs.eligibility?.rows ?? [];
  const risks = outputs.risk?.risks ?? [];
  const missing = outputs.risk?.missing_before_submission ?? [];
  const verdict = outputs.risk?.verdict ?? '';
  const flags = [...(outputs.legal?.flags ?? []), ...(outputs.legal?.exclusion_notes ?? [])];
  if (elig.length + risks.length + missing.length + flags.length === 0 && !verdict) return null;

  return (
    <details data-assistant="docs-review" open className="rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md">
      <summary className="cursor-pointer font-label-md text-label-md font-semibold text-on-surface">{t('title')}</summary>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{t('hint')}</p>
      <div className="mt-space-sm flex flex-col gap-space-md">
        {verdict && <p className="font-body-md text-body-md text-on-surface">{verdict}</p>}
        {missing.length > 0 && (
          <section>
            <h4 className="font-label-md text-label-md font-semibold text-on-surface">{t('missing')}</h4>
            <ul className="mt-1 list-disc pl-5 font-body-md text-body-md text-on-surface">
              {missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
        )}
        {elig.length > 0 && (
          <section>
            <h4 className="font-label-md text-label-md font-semibold text-on-surface">{t('requirements')}</h4>
            <ul className="mt-1 flex flex-col gap-1.5">
              {elig.map((r, i) => (
                <li key={i} className="flex gap-space-xs font-body-sm text-body-sm text-on-surface">
                  <span className={clsx('h-fit shrink-0 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold', STATUS_STYLE[r.status])}>
                    {t(r.status)}
                  </span>
                  <span>
                    <span className="font-semibold">{r.ref}</span> {r.requirement}
                    {r.basis && <span className="text-on-surface-variant"> · {r.basis}</span>}
                    {r.action && <span className="text-navy"> → {r.action}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {risks.length > 0 && (
          <section>
            <h4 className="font-label-md text-label-md font-semibold text-on-surface">{t('risks')}</h4>
            <ul className="mt-1 flex flex-col gap-1.5">
              {risks.map((r, i) => (
                <li key={i} className="font-body-sm text-body-sm text-on-surface">
                  <span className="font-semibold">{r.risk}</span>
                  <span className="text-on-surface-variant"> ({t(`level_${r.likelihood}`)} / {t(`level_${r.impact}`)})</span>
                  {r.mitigation && <span> → {r.mitigation}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {flags.length > 0 && (
          <section>
            <h4 className="font-label-md text-label-md font-semibold text-on-surface">{t('legal')}</h4>
            <ul className="mt-1 list-disc pl-5 font-body-sm text-body-sm text-on-surface">
              {flags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
