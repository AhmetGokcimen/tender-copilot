'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useEvidence, useTenders } from '@/lib/queries';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import type { EvidenceDocument } from '@/lib/types';
import { daysUntil, formatDate, formatRON, tenderTitle } from '@/lib/format';

function DocStatus({ doc }: { doc: EvidenceDocument }) {
  const t = useTranslations('archive');
  const days = daysUntil(doc.valid_until);
  if (doc.valid_until === null || (days !== null && days > 60)) {
    return (
      <span className="inline-flex h-6 items-center rounded-full border border-outline-variant bg-surface-container-low px-space-xs font-label-md text-label-md text-on-surface">
        {t('valid')}
      </span>
    );
  }
  if (days !== null && days >= 0) {
    return (
      <span className="inline-flex h-6 items-center rounded-full border border-warn/30 bg-warn-bg px-space-xs font-label-md text-label-md text-warn">
        {t('expiring')}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-danger/30 bg-danger-bg px-space-xs font-label-md text-label-md text-danger-deep">
      {t('expired')}
    </span>
  );
}

const TH = 'px-space-md py-space-sm text-left font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant';
const TD = 'px-space-md py-space-sm font-body-md text-body-md text-on-surface';

export default function ArchivePage() {
  const locale = useLocale();
  const t = useTranslations('archive');
  const { data: tenders } = useTenders();
  const { data: evidence } = useEvidence();
  const statuses = usePipelineStore((s) => s.statuses);
  const [added, setAdded] = useState<EvidenceDocument[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Fiscal');
  const [validUntil, setValidUntil] = useState('');

  const results = useMemo(
    () =>
      (tenders ?? []).filter((x) => {
        const eff = statuses[x.external_id] ?? x.state.status;
        return eff === 'applied' || eff === 'rejected';
      }),
    [tenders, statuses],
  );
  const docs = useMemo(() => [...(evidence ?? []), ...added], [evidence, added]);

  return (
    <div className="flex flex-col gap-space-xl">
      <header className="flex max-w-3xl flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">{t('title')}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-space-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">{t('resultsTitle')}</h2>
        {results.length === 0 ? (
          <EmptyState icon="inbox" title={t('resultsTitle')} hint={t('emptyResults')} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className={TH}>Ref</th>
                  <th className={TH}>Tender</th>
                  <th className={TH}>Authority</th>
                  <th className={TH}>Value</th>
                  <th className={TH}>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const eff = statuses[r.external_id] ?? r.state.status;
                  return (
                    <tr key={r.external_id} className="border-b border-surface-container-low last:border-0 hover:bg-surface">
                      <td className={`${TD} tnum font-code-sm`}>{r.external_id}</td>
                      <td className={TD}>
                        <Link href={`/app/tenders/${r.external_id}`} className="hover:underline">
                          {tenderTitle(r, locale)}
                        </Link>
                      </td>
                      <td className={TD}>{r.authority}</td>
                      <td className={`${TD} tnum`}>{formatRON(r.estimated_value, true)}</td>
                      <td className={TD}>
                        {eff === 'applied' ? (
                          <span className="inline-flex h-6 items-center rounded-full bg-navy px-space-xs font-label-md text-label-md text-white">
                            {t('submitted')}
                          </span>
                        ) : (
                          <span className="inline-flex h-6 items-center rounded-full border border-outline-variant bg-surface px-space-xs font-label-md text-label-md text-on-surface-variant">
                            {t('notAwarded')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">{t('certsTitle')}</h2>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-space-xs rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo hover:bg-indigo-deep"
          >
            <Icon name="add" size="sm" />
            {t('addCert')}
          </button>
        </div>
        {formOpen && (
          <div className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm md:flex-row md:items-end">
            <label className="flex flex-1 flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
              {t('docName')}
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded border border-outline-variant px-space-sm font-body-md font-normal outline-none focus:border-navy" />
            </label>
            <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
              {t('docType')}
              <input value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded border border-outline-variant px-space-sm font-body-md font-normal outline-none focus:border-navy" />
            </label>
            <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
              {t('validUntil')}
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-9 rounded border border-outline-variant px-space-sm font-body-md font-normal outline-none focus:border-navy" />
            </label>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                setAdded((prev) => [
                  ...prev,
                  { id: `local-${Date.now()}`, name: name.trim(), type: type.trim() || 'Other', valid_until: validUntil || null },
                ]);
                setName('');
                setValidUntil('');
                setFormOpen(false);
              }}
              className="h-9 rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo disabled:opacity-50"
            >
              {t('addCert')}
            </button>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className={TH}>{t('docName')}</th>
                <th className={TH}>{t('docType')}</th>
                <th className={TH}>{t('validUntil')}</th>
                <th className={TH}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-surface-container-low last:border-0 hover:bg-surface">
                  <td className={TD}>{d.name}</td>
                  <td className={TD}>{d.type}</td>
                  <td className={`${TD} tnum`}>{formatDate(d.valid_until)}</td>
                  <td className={TD}><DocStatus doc={d} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
