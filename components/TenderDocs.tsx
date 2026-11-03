'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { pdf } from '@react-pdf/renderer';
import { FALLBACK_VAT, useCompanyData, useEvidence, useVat } from '@/lib/queries';
import { BidInputsDialog } from './BidInputsDialog';
import { PdfPreview } from './PdfPreview';
import { checklistText, fetchSupportFiles, safeName, saveBlob, strToU8, zipFiles, type PackageFile } from '@/lib/bid-package';
import { ReviewPanel } from './ReviewPanel';
import { legacyPatch } from '@/lib/legacy-profile';
import type { BidInputs } from '@/lib/bid-inputs';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { outputKey, useGeneratorStore, type DocType } from '@/stores/useGeneratorStore';
import { useAssistantStore } from '@/stores/useAssistantStore';
import { DOC_TITLES, buildDraftSections, draftFrontMatter } from '@/lib/draft-template';
import { runBidAgent } from '@/lib/api';
import { agentSummary, type AgentOutputs } from '@/lib/agents';
import { sectionsToTiptap, tiptapToMarkdown } from '@/lib/doc-convert';
import { DraftPdfDocument, draftFileName, loadPdfFonts } from '@/components/DraftPdf';
import type { AgentId, AgentState, CompanyProfile, TenderWithState } from '@/lib/types';
import { Icon } from './Icon';
import { AgentStrip, AGENT_ORDER } from './AgentStrip';
import { AgentWorkbench, type AgentLogEntry } from './AgentWorkbench';
import { CheckboxRow } from './CheckboxRow';
import { DocList } from './DocList';
import { DocEditor } from './DocEditor';

const DOCS: DocType[] = ['technical', 'financial', 'duae'];

const IDLE_AGENTS: Record<AgentId, AgentState> = {
  spec: 'pending',
  eligibility: 'pending',
  legal: 'pending',
  writer: 'pending',
  risk: 'pending',
};

/**
 * Propose the right document set from the tender itself: technical offer when
 * the file lists requirements to answer, financials when a value is published
 * (or price terms are mentioned), DUAE for every formal procedure. Direct
 * awards skip the self-declaration. Editable before generating.
 */
export function suggestDocTypes(tender: TenderWithState): Record<DocType, boolean> {
  const haystack = [
    tender.title,
    tender.raw_description ?? '',
    ...tender.state.extracted_requirements,
  ].join(' ');
  const financialMentioned =
    /(price|pricing|cost|financial|budget|payment|tender form|formular|ofert[aă] financiar|plat[aă])/i.test(
      haystack,
    );
  return {
    technical: tender.state.extracted_requirements.length > 0,
    financial: tender.estimated_value !== null || financialMentioned,
    duae: tender.procedure_type !== 'direct',
  };
}

/**
 * Tender-scoped document preparation: checkboxes with smart defaults, evidence
 * chips, the 5-agent pipeline, document list and inline editor/A4 preview.
 * Mounted keyed by tender so each tender gets fresh defaults.
 */
export function TenderDocs({ tender }: { tender: TenderWithState }) {
  const t = useTranslations('generator');
  const ta = useTranslations('analysis');
  const tp = useTranslations('procedures');
  const { data: evidence } = useEvidence();
  const storedProfile = useCompanyStore((s) => s.profile);
  const docs = useGeneratorStore((s) => s.docs);
  const generating = useGeneratorStore((s) => s.generating);
  const setDoc = useGeneratorStore((s) => s.setDoc);
  const updateDocContent = useGeneratorStore((s) => s.updateDocContent);
  const setDocEditTarget = useGeneratorStore((s) => s.setDocEditTarget);
  const setGenerating = useGeneratorStore((s) => s.setGenerating);
  const openAssistant = useAssistantStore((s) => s.setOpen);

  const [docSel, setDocSel] = useState<Record<DocType, boolean>>(() => suggestDocTypes(tender));
  const [selectedEvidence, setSelectedEvidence] = useState<string[] | null>(null);
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(IDLE_AGENTS);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [agentLog, setAgentLog] = useState<AgentLogEntry[]>([]);
  const { data: vat } = useVat();
  const { data: companyData } = useCompanyData();
  // The documents carry the real company, never the demo profile kept in the browser store.
  const profile = useMemo(
    () => (companyData ? { ...storedProfile, ...legacyPatch(companyData) } : storedProfile),
    [companyData, storedProfile],
  );
  const [review, setReview] = useState<AgentOutputs | null>(null);
  const [view, setView] = useState<'edit' | 'pdf'>('edit');
  const [pdfError, setPdfError] = useState(false);
  const [packing, setPacking] = useState<'idle' | 'all' | 'zip'>('idle');
  const [packError, setPackError] = useState(false);
  const vatRate = vat?.rate ?? FALLBACK_VAT;
  const [ask, setAsk] = useState<{ items: NonNullable<AgentOutputs['writer']>['price_items']; notes: string[]; done: (v: BidInputs | null) => void } | null>(null);
  const tAgents = useTranslations('agents');
  const language = useLocale() === 'ro' ? 'ro' : 'en';
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const runRef = useRef(0);

  useEffect(() => {
    if (evidence && selectedEvidence === null) setSelectedEvidence(evidence.map((e) => e.id));
  }, [evidence, selectedEvidence]);

  const usedEvidence = useMemo(
    () => (evidence ?? []).filter((e) => selectedEvidence?.includes(e.id)),
    [evidence, selectedEvidence],
  );
  const enabledDocs = useMemo(
    () => (Object.keys(docSel) as DocType[]).filter((d) => docSel[d]),
    [docSel],
  );
  const tenderDocs = useMemo(
    () => DOCS.map((d) => docs[outputKey(tender.external_id, d)]).filter((x) => x !== undefined),
    [tender.external_id, docs],
  );
  const suggested = useMemo(() => suggestDocTypes(tender), [tender]);
  const deviated = DOCS.some((d) => docSel[d] !== suggested[d]);
  const openDoc = openKey ? docs[openKey] : undefined;

  const completeness = useMemo(() => {
    if (enabledDocs.length === 0) return 0;
    const generated = enabledDocs.filter((d) => docs[outputKey(tender.external_id, d)] !== undefined);
    const ratio = generated.length / enabledDocs.length;
    const penalty = Math.min(40, tender.state.unmet_requirements.length * 10);
    return Math.max(0, Math.round(ratio * 100 - penalty));
  }, [tender, enabledDocs, docs]);

  const generate = async () => {
    if (enabledDocs.length === 0) return;
    const run = ++runRef.current;
    setGenerating(true);
    setCopied(false);
    setAgentStates({ ...IDLE_AGENTS });
    setAgentLog([]);
    setReview(null);
    const outputs: AgentOutputs = {};
    const evidenceNames = usedEvidence.map((e) => `${e.name} (${e.type})`);
    // Each agent does its own model call, in order, and hands its result on.
    for (const agent of AGENT_ORDER) {
      if (runRef.current !== run) return;
      setAgentStates((s) => ({ ...s, [agent]: 'active' }));
      const started = Date.now();
      let output: unknown = null;
      try {
        const context: Record<string, unknown> = {};
        for (const k of ['eligibility', 'legal', 'writer'] as const) if (outputs[k]) context[k] = outputs[k];
        output = (await runBidAgent(tender.external_id, agent, { evidence: evidenceNames, context, language })).output;
      } catch {
        output = null;
      }
      if (runRef.current !== run) return;
      (outputs as Record<string, unknown>)[agent] = output;
      const summary = output ? agentSummary(agent, outputs) : null;
      setAgentStates((s) => ({ ...s, [agent]: output ? 'done' : 'failed' }));
      setAgentLog((l) => [
        ...l,
        {
          agent,
          ms: Date.now() - started,
          failed: !output,
          text: summary ? tAgents(summary.key, { n: summary.n, m: summary.m ?? 0 }) : tAgents('failed'),
        },
      ]);
    }
    // Only the company can state its declarations and prices: ask before the documents are made.
    const inputs = await new Promise<BidInputs | null>((resolve) =>
      setAsk({ items: outputs.writer?.price_items ?? [], notes: outputs.legal?.exclusion_notes ?? [], done: resolve }),
    );
    setAsk(null);
    if (runRef.current !== run) return;
    const now = new Date().toISOString();
    for (const d of enabledDocs) {
      const sections = buildDraftSections(tender, profile, usedEvidence, d, { agents: outputs, inputs: inputs ?? undefined, vatRate });
      setDoc({
        key: outputKey(tender.external_id, d),
        doc: d,
        tenderId: tender.external_id,
        content: sectionsToTiptap(sections),
        templateHeads: sections.map((s) => s.title),
        attribution: sections.map((s) => ({ head: s.title, agent: s.agent })),
        updatedAt: now,
        edited: false,
        aiRevised: false,
      });
    }
    setOpenKey(outputKey(tender.external_id, enabledDocs[0]));
    setReview(outputs);
    setGenerating(false);
    // Fetch the PDF fonts now, while the connection is good, so the download works later.
    void loadPdfFonts().catch(() => undefined);
  };

  const toggleEvidence = (id: string) =>
    setSelectedEvidence((prev) => {
      const base = prev ?? (evidence ?? []).map((e) => e.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });

  const copy = async () => {
    if (!openDoc) return;
    try {
      await navigator.clipboard.writeText(
        `${draftFrontMatter(tender, profile, openDoc.doc)}\n${tiptapToMarkdown(openDoc.content)}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const downloadPdf = async () => {
    if (!openDoc || exporting) return;
    setExporting(true);
    setPdfError(false);
    try {
      await loadPdfFonts();
      const blob = await pdf(
        <DraftPdfDocument
          tender={tender}
          company={profile}
          doc={openDoc.doc}
          markdown={tiptapToMarkdown(openDoc.content)}
          signature={companyData?.company.signature_png ?? null}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = draftFileName(tender, profile, openDoc.doc);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setPdfError(true);
    } finally {
      setExporting(false);
    }
  };

  /** The PDF of one generated document, as the download would be. */
  const renderPdf = async (d: DocType): Promise<Blob | null> => {
    const stored = docs[outputKey(tender.external_id, d)];
    if (!stored) return null;
    await loadPdfFonts();
    return pdf(
      <DraftPdfDocument
        tender={tender}
        company={profile}
        doc={d}
        markdown={tiptapToMarkdown(stored.content)}
        signature={companyData?.company.signature_png ?? null}
      />,
    ).toBlob();
  };

  /** Every generated document, one PDF each. */
  const downloadAll = async () => {
    if (packing !== 'idle') return;
    setPacking('all');
    setPackError(false);
    try {
      for (const d of DOCS) {
        const blob = await renderPdf(d);
        if (!blob) continue;
        saveBlob(blob, draftFileName(tender, profile, d));
        await new Promise((r) => setTimeout(r, 500)); // browsers drop downloads fired back to back
      }
    } catch {
      setPackError(true);
    } finally {
      setPacking('idle');
    }
  };

  /** One ZIP: the PDFs, the company's archived certificates and files, and a checklist. */
  const downloadZip = async () => {
    if (packing !== 'idle') return;
    setPacking('zip');
    setPackError(false);
    try {
      const files: PackageFile[] = [];
      const generated: string[] = [];
      let n = 0;
      for (const d of DOCS) {
        const blob = await renderPdf(d);
        if (!blob) continue;
        n += 1;
        const name = `${String(n).padStart(2, '0')}_${draftFileName(tender, profile, d)}`;
        files.push({ path: name, data: new Uint8Array(await blob.arrayBuffer()) });
        generated.push(name);
      }
      const support = await fetchSupportFiles(companyData?.documents ?? []);
      files.push(...support.files);
      files.push({
        path: '00_LISTA_DOCUMENTE.txt',
        data: strToU8(
          checklistText({
            tenderId: tender.external_id,
            tenderTitle: tender.title,
            authority: tender.authority,
            company: profile.name,
            generated,
            support: support.files.map((f) => f.path.replace('Documente_suport/', '')),
            failed: support.failed,
            required: review?.spec?.documents_required ?? [],
          }),
        ),
      });
      saveBlob(zipFiles(files), `${safeName(tender.external_id)}_Dosar_oferta_${safeName(profile.name)}.zip`);
    } catch {
      setPackError(true);
    } finally {
      setPacking('idle');
    }
  };

  const askAi = () => {
    if (!openDoc) return;
    setDocEditTarget(openDoc.key);
    openAssistant(true);
  };

  const authors =
    openDoc !== undefined
      ? AGENT_ORDER.filter((a) => openDoc.attribution.some((x) => x.agent === a))
      : [];

  return (
    <>
    {ask && (
      <BidInputsDialog
        tender={tender}
        company={companyData?.company ?? null}
        items={ask.items}
        notes={ask.notes}
        vatRate={vatRate}
        onSubmit={(v) => ask.done(v)}
        onSkip={() => ask.done(null)}
      />
    )}
    <section
      id="tender-documents"
      data-assistant="generate-output"
      className="scroll-mt-20 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
    >
      <div className="flex max-w-3xl flex-col gap-1">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{ta('docsTitle')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{ta('docsHint')}</p>
      </div>
      <div className="mt-space-md flex flex-col gap-space-md">
        <div className="grid grid-cols-1 items-start gap-space-md rounded-lg border border-outline-variant bg-surface-depth p-space-md md:grid-cols-2">
          <fieldset className="flex flex-col gap-space-xs" disabled={generating}>
            <legend className="font-label-md text-label-md font-semibold text-on-surface">
              {t('docTypes')}
            </legend>
            {DOCS.map((d) => (
              <CheckboxRow
                key={d}
                id={`td-doc-${tender.external_id}-${d}`}
                label={t(d)}
                checked={docSel[d]}
                onChange={() => setDocSel((s) => ({ ...s, [d]: !s[d] }))}
              />
            ))}
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {ta('suggestedFor', { procedure: tp(tender.procedure_type) })}
              {deviated && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setDocSel(suggestDocTypes(tender))}
                    className="text-navy hover:underline"
                  >
                    {ta('resetSuggested')}
                  </button>
                </>
              )}
            </p>
          </fieldset>
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              {t('sources')}
            </span>
            {(evidence ?? []).length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t('noEvidence')}</p>
            ) : (
              <ul className="flex flex-wrap gap-space-xs">
                {(evidence ?? []).map((e) => {
                  const on = selectedEvidence?.includes(e.id) ?? true;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        title={e.name}
                        disabled={generating}
                        onClick={() => toggleEvidence(e.id)}
                        className={clsx(
                          'flex max-w-64 items-center gap-1 rounded-full border px-space-xs py-0.5 transition-opacity disabled:opacity-60',
                          on
                            ? 'border-navy/40 bg-navy/[0.06]'
                            : 'border-outline-variant bg-surface opacity-60',
                        )}
                      >
                        <Icon
                          name={on ? 'check_circle' : 'description'}
                          size="xs"
                          className={clsx('shrink-0', on ? 'text-navy' : 'text-on-surface-variant')}
                        />
                        <span className="truncate font-body-sm text-body-sm text-on-surface">
                          {e.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-space-sm">
          <button
            type="button"
            data-assistant="docs-generate"
            onClick={generate}
            disabled={enabledDocs.length === 0 || generating}
            className="flex h-10 items-center justify-center gap-space-xs self-start rounded-pill bg-indigo px-space-lg font-label-md text-label-md text-on-indigo transition-colors hover:bg-indigo-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              name={generating ? 'progress_activity' : 'auto_awesome'}
              size="sm"
              className={generating ? 'animate-spin' : ''}
            />
            {generating ? t('generating') : tenderDocs.length > 0 ? t('regenerate') : t('generate')}
          </button>
          {tenderDocs.length > 0 && !generating && (
            <div className="flex flex-wrap items-center gap-space-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm">
              <span className="font-label-md text-label-md font-semibold text-on-surface">{t('downloadTitle')}</span>
              <button
                type="button"
                onClick={downloadAll}
                disabled={packing !== 'idle'}
                className="inline-flex h-9 items-center gap-1 rounded-pill border border-outline-variant px-space-sm font-label-md text-label-md text-on-surface hover:bg-surface-container disabled:opacity-50"
              >
                <Icon name={packing === 'all' ? 'progress_activity' : 'download'} size="sm" className={packing === 'all' ? 'animate-spin' : ''} />
                {t('downloadAll')}
              </button>
              <button
                type="button"
                onClick={downloadZip}
                disabled={packing !== 'idle'}
                className="inline-flex h-9 items-center gap-1 rounded-pill bg-navy px-space-sm font-label-md text-label-md text-white hover:opacity-90 disabled:opacity-50"
              >
                <Icon name={packing === 'zip' ? 'progress_activity' : 'folder_zip'} size="sm" className={packing === 'zip' ? 'animate-spin' : ''} />
                {t('downloadZip')}
              </button>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t('downloadHint')}</span>
              {packError && (
                <span role="alert" className="font-body-sm text-body-sm text-error">
                  {t('packError')}
                </span>
              )}
            </div>
          )}
          {(generating || tenderDocs.length > 0) && (
            <div className="rounded-lg border border-outline-variant bg-surface-depth px-space-md py-space-sm">
              <AgentStrip states={agentStates} />
            </div>
          )}
          <AgentWorkbench states={agentStates} log={agentLog} />
          {review && !generating && <ReviewPanel outputs={review} />}
          {pdfError && (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-space-sm py-space-xs font-body-sm text-body-sm text-error">
              {t('pdfError')}
            </p>
          )}
          <div className="flex items-center gap-space-sm">
            <span className="shrink-0 font-label-md text-label-md font-semibold uppercase text-on-surface-variant">
              {t('completeness')}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-navy transition-all"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <span className="tnum shrink-0 font-headline-sm text-headline-sm text-on-surface">
              {completeness}%
            </span>
          </div>
          <div className="flex flex-col gap-space-md xl:flex-row">
            <div className="shrink-0 xl:w-64">
              <DocList
                tenderId={tender.external_id}
                docs={docs}
                activeKey={openKey}
                onSelect={setOpenKey}
              />
            </div>
            {openDoc ? (
              <OpenDocEditor
                view={view}
                onView={setView}
                profile={profile}
                signature={companyData?.company.signature_png ?? null}
                docKey={openDoc.key}
                tender={tender}
                copied={copied}
                exporting={exporting}
                authors={authors}
                onCopy={copy}
                onDownloadPdf={downloadPdf}
                onAskAi={askAi}
              />
            ) : (
              <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-space-sm rounded-lg border border-dashed border-outline-variant px-space-md text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                  <Icon name="description" size="md" />
                </span>
                <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">
                  {t('outputPlaceholder')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

/** Subscribes to the open document's content + version (hooks can't be conditional). */
function OpenDocEditor({
  view,
  onView,
  profile,
  signature,
  docKey,
  tender,
  copied,
  exporting,
  authors,
  onCopy,
  onDownloadPdf,
  onAskAi,
}: {
  view: 'edit' | 'pdf';
  onView: (v: 'edit' | 'pdf') => void;
  profile: CompanyProfile;
  signature: string | null;
  docKey: string;
  tender: TenderWithState;
  copied: boolean;
  exporting: boolean;
  authors: AgentId[];
  onCopy: () => void;
  onDownloadPdf: () => void;
  onAskAi: () => void;
}) {
  const doc = useGeneratorStore((s) => s.docs[docKey]);
  const contentVersion = useGeneratorStore((s) => s.contentVersion[docKey] ?? 0);
  const updateDocContent = useGeneratorStore((s) => s.updateDocContent);
  const tg = useTranslations('generator');
  if (!doc) return null;
  const toggle = (
    <div role="tablist" className="mb-space-xs inline-flex self-start rounded-full bg-surface-container-high p-0.5">
      {(['edit', 'pdf'] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          onClick={() => onView(id)}
          className={clsx(
            'h-8 rounded-full px-space-md font-label-md text-label-md transition-colors',
            view === id ? 'bg-navy text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          {id === 'edit' ? tg('viewEdit') : tg('viewPdf')}
        </button>
      ))}
    </div>
  );
  if (view === 'pdf') {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        {toggle}
        <PdfPreview
          tender={tender}
          company={profile}
          doc={doc.doc}
          markdown={tiptapToMarkdown(doc.content)}
          signature={signature}
        />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col">
    {toggle}
    <DocEditor
      key={doc.key}
      docKey={doc.key}
      title={DOC_TITLES[doc.doc]}
      initialContent={doc.content}
      contentVersion={contentVersion}
      storeContent={doc.content}
      authors={authors}
      edited={doc.edited}
      aiRevised={doc.aiRevised}
      exporting={exporting}
      copied={copied}
      onContentChange={(content) => updateDocContent(doc.key, content)}
      onAskAi={onAskAi}
      onCopy={onCopy}
      onDownloadPdf={onDownloadPdf}
    />
    </div>
  );
}
