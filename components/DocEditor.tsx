'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import type { AgentId } from '@/lib/types';
import { Icon } from './Icon';

const A4_RATIO = 297 / 210;
const SAVE_DEBOUNCE_MS = 600;

function ToolButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'flex h-8 w-8 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface',
        active && 'bg-surface-container-high text-on-surface',
      )}
    >
      <Icon name={icon} size="sm" />
    </button>
  );
}

export function DocEditor({
  docKey,
  title,
  initialContent,
  contentVersion,
  storeContent,
  authors,
  edited,
  aiRevised,
  exporting,
  copied,
  onContentChange,
  onAskAi,
  onCopy,
  onDownloadPdf,
}: {
  docKey: string;
  title: string;
  initialContent: JSONContent;
  contentVersion: number;
  storeContent: JSONContent;
  authors: AgentId[];
  edited: boolean;
  aiRevised: boolean;
  exporting: boolean;
  copied: boolean;
  onContentChange: (content: JSONContent) => void;
  onAskAi: () => void;
  onCopy: () => void;
  onDownloadPdf: () => void;
}) {
  const t = useTranslations('generator');
  const tag = useTranslations('agents');
  const [pending, setPending] = useState(false);
  const [pages, setPages] = useState(1);
  const [sheetW, setSheetW] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const latestJson = useRef<JSONContent | null>(null);
  const mountedVersion = useRef(contentVersion);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    editorProps: { attributes: { class: 'doc-editor', 'aria-label': title } },
    onUpdate: ({ editor: ed }) => {
      latestJson.current = ed.getJSON();
      setPending(true);
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        if (latestJson.current) onContentChange(latestJson.current);
        setPending(false);
      }, SAVE_DEBOUNCE_MS);
      window.setTimeout(recompute, 0);
    },
  });

  const recompute = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) return;
    setSheetW(w);
    setPages(Math.max(1, Math.ceil(el.scrollHeight / ((w * A4_RATIO) || 1))));
  }, []);

  // Flush a pending save when switching documents.
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      if (latestJson.current) onContentChange(latestJson.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docKey],
  );

  // External changes (AI revision accepted, regenerate) reload the editor.
  useEffect(() => {
    if (editor && contentVersion !== mountedVersion.current) {
      mountedVersion.current = contentVersion;
      latestJson.current = null;
      editor.commands.setContent(storeContent);
      setPending(false);
      window.setTimeout(recompute, 0);
    }
  }, [editor, contentVersion, storeContent, recompute]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-space-sm">
      <div className="flex flex-wrap items-center gap-space-xs">
        <h3 className="min-w-0 flex-1 truncate font-headline-sm text-headline-sm text-on-surface">
          {title}
        </h3>
        {aiRevised && (
          <span className="rounded-full bg-navy/10 px-space-xs py-px font-label-sm text-label-sm text-navy">
            {t('aiRevised')}
          </span>
        )}
        {edited && (
          <span className="rounded-full border border-warn/30 bg-warn-bg px-space-xs py-px font-label-sm text-label-sm text-warn">
            {t('edited')}
          </span>
        )}
      </div>
      <p className="tnum font-code-sm text-code-sm text-on-surface-variant">
        {t('authors')}: {authors.map((a) => tag(a)).join(' · ')}
      </p>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className="flex items-center gap-px rounded-lg border border-outline-variant bg-surface-container-lowest p-0.5">
          <ToolButton
            icon="format_bold"
            label={t('fmtBold')}
            active={editor?.isActive('bold') ?? false}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolButton
            icon="format_italic"
            label={t('fmtItalic')}
            active={editor?.isActive('italic') ?? false}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolButton
            icon="format_list_bulleted"
            label={t('fmtBullets')}
            active={editor?.isActive('bulletList') ?? false}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolButton
            icon="format_list_numbered"
            label={t('fmtNumbered')}
            active={editor?.isActive('orderedList') ?? false}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
        </div>
        <button
          type="button"
          data-assistant="workspace-ask-ai"
          onClick={onAskAi}
          className="flex h-9 items-center gap-space-xs rounded-lg border border-navy/40 px-space-sm font-label-md text-label-md text-navy transition-colors hover:bg-navy hover:text-white"
        >
          <Icon name="auto_awesome" size="sm" />
          {t('askAi')}
        </button>
        <div className="ml-auto flex items-center gap-space-xs">
          <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
            {pending ? t('saving') : t('saved')}
          </span>
          <button
            type="button"
            onClick={onCopy}
            title={t('copy')}
            className="rounded border border-outline-variant p-1.5 text-on-surface-variant hover:text-on-surface"
          >
            <Icon name={copied ? 'check' : 'content_copy'} size="sm" />
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={exporting}
            title={t('exportPdf')}
            className="rounded border border-outline-variant p-1.5 text-on-surface-variant hover:text-on-surface disabled:opacity-40"
          >
            <Icon name={exporting ? 'progress_activity' : 'file_download'} size="sm" />
          </button>
        </div>
      </div>
      <div
        ref={sheetRef}
        data-assistant="workspace-editor"
        style={sheetW > 0 ? { minHeight: sheetW * A4_RATIO } : undefined}
        className="relative rounded-[3px] border border-outline-variant bg-white px-[10%] py-[8%] shadow-[0_2px_16px_rgba(11,19,43,0.14)]"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {sheetW > 0 &&
            Array.from({ length: pages - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-dashed border-outline-variant"
                style={{ top: ((i + 1) * sheetW * A4_RATIO) / 1 }}
              >
                <span className="tnum absolute right-2 -top-2 bg-white px-1 font-code-sm text-code-sm text-on-surface-variant">
                  {t('pageN', { n: i + 2 })}
                </span>
              </div>
            ))}
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
