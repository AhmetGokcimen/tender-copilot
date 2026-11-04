'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import type { AgentOutputs } from '@/lib/agents';
import { Icon } from '@/components/Icon';

const STATUS_STYLE = {
  met: 'bg-success/15 text-success',
  not_met: 'bg-error/15 text-error',
  unclear: 'bg-surface-container-high text-on-surface-variant',
} as const;

/** Rows shown per section before "show all". */
const PREVIEW = 4;

function clip(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

function Section({ title, count, children }: { title: string; count: number; children: (limit: number) => React.ReactNode }) {
  const t = useTranslations('review');
  const [all, setAll] = useState(false);
  return (
    <section>
      <h4 className="font-label-md text-label-md font-semibold text-on-surface">
        {title} <span className="font-normal text-on-surface-variant">({count})</span>
      </h4>
      <div className="mt-1">{children(all ? count : PREVIEW)}</div>
      {count > PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 font-body-sm text-body-sm text-navy hover:underline">
          {all ? t('showLess') : t('showAll', { n: count })}
        </button>
      )}
    </section>
  );
}

/**
 * What the agents found but kept out of the submitted documents: how each
 * requirement checks out against the company, the risks, and what is still
 * missing before submission. Collapsed by default behind one arrow; each list
 * shows its first few short lines and the rest on request.
 */
export function ReviewPanel({ outputs }: { outputs: AgentOutputs }) {
  const t = useTranslations('review');
  const [open, setOpen] = useState(false);
  const elig = outputs.eligibility?.rows ?? [];
  const risks = outputs.risk?.risks ?? [];
  const missing = outputs.risk?.missing_before_submission ?? [];
  const verdict = outputs.risk?.verdict ?? '';
  const flags = [...(outputs.legal?.flags ?? []), ...(outputs.legal?.exclusion_notes ?? [])];
  if (elig.length + risks.length + missing.length + flags.length === 0 && !verdict && !(outputs.spec?.flags?.length)) return null;

  const metCount = elig.filter((r) => r.status === 'met').length;

  return (
    <section data-assistant="docs-review" className="rounded-lg border border-outline-variant bg-surface-container-lowest">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-space-sm p-space-md text-left"
      >
        <Icon name={open ? 'expand_less' : 'expand_more'} size="md" className="shrink-0 text-on-surface-variant" />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{t('title')}</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {t('counts', { missing: missing.length, risks: risks.length, met: metCount, total: elig.length })}
          </span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-space-md border-t border-outline-variant p-space-md">
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t('hint')}</p>
          {(outputs.spec?.flags?.length ?? 0) > 0 && (
            <p role="alert" className="rounded-md border border-warn/40 bg-warn-bg px-space-sm py-space-xs font-body-sm text-body-sm text-warn">
              {t('flags')}
            </p>
          )}
          {verdict && <p className="font-body-md text-body-md text-on-surface">{clip(verdict, 280)}</p>}
          {missing.length > 0 && (
            <Section title={t('missing')} count={missing.length}>
              {(n) => (
                <ul className="list-disc pl-5 font-body-sm text-body-sm text-on-surface">
                  {missing.slice(0, n).map((m, i) => (
                    <li key={i}>{clip(m, 130)}</li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          {elig.length > 0 && (
            <Section title={t('requirements')} count={elig.length}>
              {(n) => (
                <ul className="flex flex-col gap-1.5">
                  {elig.slice(0, n).map((r, i) => (
                    <li key={i} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface">
                      <span className={clsx('shrink-0 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold', STATUS_STYLE[r.status])}>
                        {t(r.status)}
                      </span>
                      <span>
                        <span className="font-semibold">{r.ref}</span> {clip(r.requirement, 110)}
                        {r.action && <span className="text-navy"> → {clip(r.action, 100)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          {risks.length > 0 && (
            <Section title={t('risks')} count={risks.length}>
              {(n) => (
                <ul className="flex flex-col gap-1.5">
                  {risks.slice(0, n).map((r, i) => (
                    <li key={i} className="font-body-sm text-body-sm text-on-surface">
                      <span className="font-semibold">{clip(r.risk, 110)}</span>
                      <span className="text-on-surface-variant"> ({t(`level_${r.likelihood}`)} / {t(`level_${r.impact}`)})</span>
                      {r.mitigation && <span> → {clip(r.mitigation, 100)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          {flags.length > 0 && (
            <Section title={t('legal')} count={flags.length}>
              {(n) => (
                <ul className="list-disc pl-5 font-body-sm text-body-sm text-on-surface">
                  {flags.slice(0, n).map((f, i) => (
                    <li key={i}>{clip(f, 130)}</li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      )}
    </section>
  );
}
