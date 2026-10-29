'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { DOC_TITLES } from '@/lib/draft-template';
import { docHeadings } from '@/lib/doc-convert';
import type { DocType, WorkspaceDoc } from '@/stores/useGeneratorStore';
import { Icon } from './Icon';

const DOCS: DocType[] = ['technical', 'financial', 'duae'];

const DOC_ICONS: Record<DocType, string> = {
  technical: 'description',
  financial: 'table_view',
  duae: 'badge',
};

/** Share of template sections still present — honest, deletion-aware. */
function docCompleteness(doc: WorkspaceDoc): number {
  if (doc.templateHeads.length === 0) return 100;
  const current = new Set(docHeadings(doc.content));
  const present = doc.templateHeads.filter((h) => current.has(h)).length;
  return Math.round((present / doc.templateHeads.length) * 100);
}

export function DocList({
  tenderId,
  docs,
  activeKey,
  onSelect,
}: {
  tenderId: string;
  docs: Record<string, WorkspaceDoc>;
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  const t = useTranslations('generator');
  const mine = Object.values(docs).filter((x) => x.tenderId === tenderId);
  return (
    <div data-assistant="workspace-docs" className="flex min-w-0 flex-col gap-space-xs">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
        {t('docsTitle')}
      </span>
      {DOCS.map((d) => {
        const doc = mine.find((x) => x.doc === d);
        const active = doc !== undefined && doc.key === activeKey;
        return (
          <button
            key={d}
            type="button"
            disabled={!doc}
            onClick={() => doc && onSelect(doc.key)}
            className={clsx(
              'flex items-center gap-space-sm rounded-lg border p-space-sm text-left transition-colors',
              active
                ? 'border-navy bg-navy/[0.06]'
                : doc
                  ? 'border-outline-variant bg-surface-container-lowest hover:border-navy/50'
                  : 'cursor-default border-outline-variant bg-surface opacity-70',
            )}
          >
            <span
              className={clsx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                active ? 'bg-navy text-white' : 'bg-surface-container text-on-surface-variant',
              )}
            >
              <Icon name={DOC_ICONS[d]} size="sm" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                {DOC_TITLES[d]}
              </span>
              {doc ? (
                <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
                  {docCompleteness(doc)}% ·{' '}
                  <span
                    className={
                      doc.aiRevised ? 'text-navy' : doc.edited ? 'text-warn' : 'text-info'
                    }
                  >
                    {doc.aiRevised ? t('aiRevised') : doc.edited ? t('edited') : t('ready')}
                  </span>
                </span>
              ) : (
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  {t('notGenerated')}
                </span>
              )}
            </span>
            {doc && (
              <Icon
                name="chevron_right"
                size="sm"
                className={active ? 'text-navy' : 'text-on-surface-variant'}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
