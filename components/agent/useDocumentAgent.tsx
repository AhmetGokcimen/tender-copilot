'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AgentStage, type AgentFact } from '@/components/agent/AgentStage';
import { scanDocument, type ScannedDocument } from '@/lib/actions/document-scan';
import { addDocument, credentialState, updateDocument } from '@/lib/company-data';
import { groupDigits } from '@/components/onboarding/steps';

const fmtDate = (iso: string | null, locale: string) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-GB') : '';

/**
 * Upload + scan flow shared by onboarding and the profile: stores the file,
 * runs the document agent, shows what it read, then hands the result to
 * the caller to fill fields (the user still confirms every value there).
 */
export function useDocumentAgent(companyId: string | null, locale: string) {
  const t = useTranslations('agent');
  const [view, setView] = useState<{
    file: string;
    running: boolean;
    facts: AgentFact[];
    error?: string;
    note?: string;
  } | null>(null);

  const facts = (d: ScannedDocument): AgentFact[] => {
    const out: AgentFact[] = [{ label: t('docType'), value: t(`docType_${d.doc_type}`) }];
    const add = (label: string, value: string | null | undefined, tone?: AgentFact['tone']) => {
      if (value) out.push({ label, value, tone });
    };
    add(t('issuer'), d.issuer);
    add(t('number'), d.number);
    add(t('holder'), [d.holder, d.holder_cui].filter(Boolean).join(' · '));
    add(t('typeClass'), d.type_class);
    add(t('standard'), d.standard);
    add(t('scope'), d.scope);
    add(t('issuedOn'), fmtDate(d.issued_on, locale));
    if (d.expires_on) {
      const state = credentialState({ expires_on: d.expires_on });
      add(
        t('expiresOn'),
        `${fmtDate(d.expires_on, locale)}${state === 'expired' ? ` · ${t('expired')}` : state === 'expiring' ? ` · ${t('expiring')}` : ''}`,
        state === 'expired' ? 'risk' : state === 'expiring' ? 'warn' : 'ok',
      );
    }
    if (d.caen_codes.length) add(t('caen'), d.caen_codes.join(', '));
    if (d.balance?.turnover != null)
      add(t('turnover'), `${d.balance.year ?? ''} · ${groupDigits(String(Math.round(d.balance.turnover)))} ${d.balance.currency ?? 'RON'}`);
    if (d.contract) {
      add(t('contractTitle'), d.contract.title);
      add(t('contractClient'), d.contract.client);
      if (d.contract.value != null)
        add(t('contractValue'), `${groupDigits(String(Math.round(d.contract.value)))} ${d.contract.currency ?? 'RON'}`);
      add(t('completedOn'), fmtDate(d.contract.completed_on, locale));
    }
    return out;
  };

  const run = async (file: File, onResult: (doc: ScannedDocument, documentId: string | null) => void) => {
    setView({ file: file.name, running: true, facts: [] });
    const started = Date.now();
    let docId: string | null = null;
    try {
      if (companyId) docId = (await addDocument(companyId, file)).id;
    } catch {
      docId = null;
    }
    const form = new FormData();
    form.set('file', file);
    const result = await scanDocument(form).catch(() => ({ status: 'unreadable' as const }));
    await new Promise((r) => setTimeout(r, Math.max(0, 2400 - (Date.now() - started))));
    if (result.status !== 'ok') {
      if (docId) await updateDocument(docId, { status: 'failed' }).catch(() => undefined);
      setView({ file: file.name, running: false, facts: [], error: t(`fail_${result.status}`) });
      return;
    }
    if (docId) {
      await updateDocument(docId, {
        status: 'scanned',
        doc_type: result.doc.doc_type,
        extracted: result.doc as unknown as Record<string, unknown>,
      }).catch(() => undefined);
    }
    setView({ file: file.name, running: false, facts: facts(result.doc), note: t('confirmNote') });
    onResult(result.doc, docId);
  };

  const stage = view && (
    <AgentStage
      icon="document_scanner"
      title={t('docTitle')}
      subject={view.file}
      stages={[t('docStageUpload'), t('docStageRead'), t('docStageExtract')]}
      running={view.running}
      facts={view.facts}
      note={view.note}
      error={view.error}
      onClose={() => setView(null)}
      closeLabel={t('done')}
    />
  );

  return { stage, run, busy: view?.running ?? false };
}
