'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { pdf } from '@react-pdf/renderer';
import { useEvidence } from '@/lib/queries';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { outputKey, useGeneratorStore, type DocType } from '@/stores/useGeneratorStore';
import { useAssistantStore } from '@/stores/useAssistantStore';
import { DOC_TITLES, buildDraftSections, draftFrontMatter, mockDelay } from '@/lib/draft-template';
import { sectionsToTiptap, tiptapToMarkdown } from '@/lib/doc-convert';
import { DraftPdfDocument, draftFileName } from '@/components/DraftPdf';
import type { AgentId, AgentState, TenderWithState } from '@/lib/types';
import { Icon } from './Icon';
import { AgentStrip, AGENT_ORDER } from './AgentStrip';
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
  const profile = useCompanyStore((s) => s.profile);
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
    const now = new Date().toISOString();
    for (const d of enabledDocs) {
      const sections = buildDraftSections(tender, profile, usedEvidence, d);
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
    for (const agent of AGENT_ORDER) {
      if (runRef.current !== run) return;
      setAgentStates((s) => ({ ...s, [agent]: 'active' }));
      await mockDelay(600);
      if (runRef.current !== run) return;
      setAgentStates((s) => ({ ...s, [agent]: 'done' }));
    }
    setGenerating(false);
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
    try {
      const blob = await pdf(
        <DraftPdfDocument
          tender={tender}
          company={profile}
          doc={openDoc.doc}
          markdown={tiptapToMarkdown(openDoc.content)}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = draftFileName(tender, profile, openDoc.doc);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
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
    <section
      id="tender-documents"
      data-assistant="generate-output"
      className="scroll-mt-20 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
    >
      <div className="flex max-w-3xl flex-col gap-1">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{ta('docsTitle')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{ta('docsHint')}</p>
      </div>
      <div className="mt-space-md grid grid-cols-1 items-start gap-space-md lg:grid-cols-12">
        <div className="flex flex-col gap-space-md lg:col-span-4">
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
          <button
            type="button"
            data-assistant="docs-generate"
            onClick={generate}
            disabled={enabledDocs.length === 0 || generating}
            className="flex h-10 items-center justify-center gap-space-xs rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo transition-colors hover:bg-indigo-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              name={generating ? 'progress_activity' : 'auto_awesome'}
              size="sm"
              className={generating ? 'animate-spin' : ''}
            />
            {generating ? t('generating') : tenderDocs.length > 0 ? t('regenerate') : t('generate')}
          </button>
        </div>
        <div className="flex flex-col gap-space-sm lg:col-span-8">
          {(generating || tenderDocs.length > 0) && (
            <div className="rounded-lg border border-outline-variant bg-surface-depth px-space-md py-space-sm">
              <AgentStrip states={agentStates} />
            </div>
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
  );
}

/** Subscribes to the open document's content + version (hooks can't be conditional). */
function OpenDocEditor({
  docKey,
  tender,
  copied,
  exporting,
  authors,
  onCopy,
  onDownloadPdf,
  onAskAi,
}: {
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
  if (!doc) return null;
  return (
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
  );
}
