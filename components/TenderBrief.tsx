'use client';

import { useTranslations } from 'next-intl';
import { Icon } from './Icon';
import type { TenderBriefText } from '@/lib/types';

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-space-xs">
      {items.map((x, i) => (
        <li key={i} className="flex gap-space-xs font-body-md text-body-md text-on-surface">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-navy/60" aria-hidden />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <h3 className="font-label-md text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">{title}</h3>
      {children}
    </div>
  );
}

/**
 * What the job is and how it is to be done, read from the notice and its
 * specification: scope, method, conditions, what to check, and what the
 * documents leave unsaid. Shown instead of the one-line summary when ready.
 */
export function TenderBriefView({
  brief,
  fromDocuments,
  flags = [],
}: {
  brief: TenderBriefText;
  fromDocuments: boolean;
  flags?: string[];
}) {
  const t = useTranslations('analysis');
  return (
    <div className="flex flex-col gap-space-md">
      {flags.length > 0 && (
        <p role="alert" className="flex items-start gap-1.5 rounded-md border border-warn/40 bg-warn-bg px-space-sm py-space-xs font-body-sm text-body-sm text-warn">
          <Icon name="warning" size="xs" className="mt-0.5 shrink-0" />
          {t('briefFlags')}
        </p>
      )}
      <p className="font-body-lg text-body-lg text-on-surface">{brief.overview}</p>
      {brief.scope.length > 0 && (
        <Block title={t('briefScope')}>
          <List items={brief.scope} />
        </Block>
      )}
      {brief.method.length > 0 && (
        <Block title={t('briefMethod')}>
          <List items={brief.method} />
        </Block>
      )}
      {brief.conditions.length > 0 && (
        <Block title={t('briefConditions')}>
          <dl>
            {brief.conditions.map((c, i) => (
              <div key={i} className="grid grid-cols-1 gap-0.5 border-b border-surface-container-low py-space-xs last:border-0 md:grid-cols-3 md:gap-1">
                <dt className="font-label-md text-label-md text-on-surface-variant">{c.label}</dt>
                <dd className="font-body-md text-body-md text-on-surface md:col-span-2">{c.value}</dd>
              </div>
            ))}
          </dl>
        </Block>
      )}
      {brief.watch_outs.length > 0 && (
        <Block title={t('briefWatch')}>
          <List items={brief.watch_outs} />
        </Block>
      )}
      {brief.not_stated.length > 0 && (
        <Block title={t('briefUnknown')}>
          <List items={brief.not_stated} />
        </Block>
      )}
      <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
        <Icon name="info" size="xs" />
        {fromDocuments ? t('briefFromDocs') : t('briefFromNotice')}
      </p>
    </div>
  );
}
