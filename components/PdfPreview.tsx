'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { pdf } from '@react-pdf/renderer';
import { DraftPdfDocument, loadPdfFonts } from './DraftPdf';
import { Icon } from './Icon';
import type { CompanyProfile, TenderWithState } from '@/lib/types';
import type { DocType } from '@/stores/useGeneratorStore';

/**
 * The document exactly as the downloaded PDF will look: it is built by the same
 * renderer and shown in the browser's own PDF viewer, so what you see here is
 * what you download.
 */
export function PdfPreview({
  tender,
  company,
  doc,
  markdown,
  signature,
}: {
  tender: TenderWithState;
  company: CompanyProfile;
  doc: DocType;
  markdown: string;
  signature: string | null;
}) {
  const t = useTranslations('generator');
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let dead = false;
    let made: string | null = null;
    setUrl(null);
    setFailed(false);
    (async () => {
      try {
        await loadPdfFonts();
        const blob = await pdf(
          <DraftPdfDocument tender={tender} company={company} doc={doc} markdown={markdown} signature={signature} />,
        ).toBlob();
        if (dead) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => {
      dead = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [tender, company, doc, markdown, signature, attempt]);

  if (failed) {
    return (
      <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-space-sm rounded-lg border border-dashed border-outline-variant p-space-md text-center">
        <p role="alert" className="max-w-sm font-body-md text-body-md text-on-surface-variant">
          {t('pdfError')}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="h-9 rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo hover:bg-indigo-deep"
        >
          {t('pdfRetry')}
        </button>
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center gap-space-xs rounded-lg border border-outline-variant text-on-surface-variant" aria-busy="true">
        <Icon name="progress_activity" size="sm" className="animate-spin" />
        <span className="font-body-md text-body-md">{t('pdfBuilding')}</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-space-xs">
      <iframe
        title={t('pdfPreview')}
        src={`${url}#toolbar=0&navpanes=0&view=FitH`}
        className="h-[78dvh] min-h-[480px] w-full rounded-lg border border-outline-variant bg-white"
      />
      <a href={url} target="_blank" rel="noopener noreferrer" className="self-end font-body-sm text-body-sm text-navy hover:underline">
        {t('pdfOpen')}
      </a>
    </div>
  );
}
