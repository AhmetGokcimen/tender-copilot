'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { usePathname } from '@/i18n/routing';
import { useTender } from '@/lib/queries';
import { Icon } from '../Icon';
import { DOC_TITLES } from '@/lib/draft-template';
import { useAssistantStore, type DockAnchor } from '@/stores/useAssistantStore';
import { useGeneratorStore } from '@/stores/useGeneratorStore';

const MARGIN = 16;
const SIZE = {
  compact: { w: 380, h: 520 },
  expanded: { w: 480, h: 680 },
};

function tenderIdFrom(pathname: string): string | null {
  const m = /^\/app\/tenders\/([^/]+)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

function useViewport() {
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return vp;
}

function anchorXY(a: DockAnchor, w: number, h: number, vw: number, vh: number) {
  const x = a.endsWith('l') ? MARGIN : a.endsWith('r') ? vw - w - MARGIN : Math.round((vw - w) / 2);
  const y = a.startsWith('t') ? MARGIN : a.startsWith('b') ? vh - h - MARGIN : Math.round((vh - h) / 2);
  return { x: Math.max(MARGIN, x), y: Math.max(MARGIN, y) };
}

function nearestAnchor(cx: number, cy: number, vw: number, vh: number): DockAnchor {
  const cols: [number, 'l' | 'c' | 'r'][] = [
    [MARGIN, 'l'],
    [vw / 2, 'c'],
    [vw - MARGIN, 'r'],
  ];
  const rows: [number, 't' | 'm' | 'b'][] = [
    [MARGIN, 't'],
    [vh / 2, 'm'],
    [vh - MARGIN, 'b'],
  ];
  const bx = cols.reduce((a, b) => (Math.abs(b[0] - cx) < Math.abs(a[0] - cx) ? b : a))[1];
  const by = rows.reduce((a, b) => (Math.abs(b[0] - cy) < Math.abs(a[0] - cy) ? b : a))[1];
  if (bx === 'c' && by === 'm') return cx < vw / 2 ? 'ml' : 'mr';
  return `${by}${bx}` as DockAnchor;
}

export function AssistantPanel() {
  const t = useTranslations('assistant');
  const pathname = usePathname();
  const tenderId = tenderIdFrom(pathname);
  const { data: tender } = useTender(tenderId ?? '', !!tenderId);
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const expanded = useAssistantStore((s) => s.expanded);
  const toggleExpanded = useAssistantStore((s) => s.toggleExpanded);
  const anchor = useAssistantStore((s) => s.anchor);
  const setAnchor = useAssistantStore((s) => s.setAnchor);
  const messages = useAssistantStore((s) => s.messages);
  const sending = useAssistantStore((s) => s.sending);
  const seedGreeting = useAssistantStore((s) => s.seedGreeting);
  const send = useAssistantStore((s) => s.send);
  const appendAi = useAssistantStore((s) => s.appendAi);
  const clear = useAssistantStore((s) => s.clear);
  const pendingRevision = useGeneratorStore((s) => s.pendingRevision);
  const acceptRevision = useGeneratorStore((s) => s.acceptRevision);
  const rejectRevision = useGeneratorStore((s) => s.rejectRevision);
  const targetDoc = useGeneratorStore((s) =>
    s.docEditTarget ? s.docs[s.docEditTarget] : undefined,
  );
  const [draft, setDraft] = useState('');
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const vp = useViewport();

  const dims = SIZE[expanded ? 'expanded' : 'compact'];
  const w = Math.min(dims.w, vp.w - MARGIN * 2);
  const h = Math.min(dims.h, vp.h - MARGIN * 2);
  const docked = anchorXY(anchor, w, h, vp.w, vp.h);
  const pos = dragPos ?? docked;

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      seedGreeting(t('greeting'));
    }
  }, [seedGreeting, t]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, open]);

  const editing = targetDoc && pathname.includes('/app/tenders/') ? targetDoc : undefined;
  const suggestions = editing
    ? [t('suggestShorten'), t('suggestNote'), t('suggestReplace')]
    : tenderId
      ? [t('suggestEligible'), t('suggestMissing'), t('suggestDraft')]
      : [t('suggestCapable'), t('suggestWhere'), t('suggestScore')];

  const submit = (text: string) => {
    if (!text.trim() || sending) return;
    setDraft('');
    void send(text, { pathname, tenderId, errorText: t('error') });
  };

  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(8, x), Math.max(8, vp.w - w - 8)),
    y: Math.min(Math.max(8, y), Math.max(8, vp.h - h - 8)),
  });

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setDragPos({ ...pos });
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragOffset.current) return;
    setDragPos(clamp(e.clientX - dragOffset.current.dx, e.clientY - dragOffset.current.dy));
  };

  const onHeaderPointerUp = (e: React.PointerEvent) => {
    if (!dragOffset.current || !dragPos) return;
    dragOffset.current = null;
    setDragPos(null);
    setAnchor(nearestAnchor(dragPos.x + w / 2, dragPos.y + h / 2, vp.w, vp.h));
  };

  return (
    <aside
      data-assistant-ui
      aria-hidden={!open}
      aria-label={t('title')}
      style={{ left: pos.x, top: pos.y, width: w, height: h }}
      className={clsx(
        'fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl',
        dragPos == null && 'transition-[left,top,opacity,transform] duration-150',
        open ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={() => {
          dragOffset.current = null;
          setDragPos(null);
        }}
        className="flex cursor-move touch-none select-none items-center gap-space-sm border-b border-outline-variant px-space-md py-space-sm"
      >
        <Icon name="drag_indicator" size="sm" className="shrink-0 text-on-surface-variant" />
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
          <Icon name="auto_awesome" size="sm" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-headline-sm text-headline-sm text-on-surface">{t('title')}</span>
          {editing ? (
            <span className="tnum truncate font-code-sm text-code-sm text-navy">
              {t('contextDoc')}: {DOC_TITLES[editing.doc]}
            </span>
          ) : tender && tenderId ? (
            <span className="tnum truncate font-code-sm text-code-sm text-on-surface-variant">
              {t('contextTender')}: {tenderId} · {tender.state.score ?? '—'}%
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleExpanded}
          title={t('expand')}
          className="rounded p-1.5 text-on-surface-variant hover:text-on-surface"
        >
          <Icon name={expanded ? 'close_fullscreen' : 'open_in_full'} size="sm" />
        </button>
        <button
          type="button"
          onClick={clear}
          title={t('clear')}
          className="rounded p-1.5 text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="delete" size="sm" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title={t('close')}
          className="rounded p-1.5 text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>
      <div
        ref={listRef}
        className="thin-scroll flex flex-1 flex-col gap-space-sm overflow-y-auto px-space-md py-space-md"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <p
              className={clsx(
                'max-w-[85%] rounded-lg px-space-sm py-space-xs font-body-md text-body-md',
                m.role === 'user'
                  ? 'bg-navy text-white'
                  : 'border border-navy/15 bg-navy/10 text-on-surface',
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <p className="flex items-center gap-space-xs rounded-lg border border-navy/15 bg-navy/10 px-space-sm py-space-xs font-body-md text-body-md text-on-surface-variant">
              <Icon name="progress_activity" size="sm" className="animate-spin" />
              {t('thinking')}
            </p>
          </div>
        )}
        {pendingRevision && (
          <div className="flex flex-col gap-space-xs rounded-lg border border-navy/25 bg-surface p-space-sm">
            <span className="font-label-md text-label-md font-semibold text-navy">
              {t('revisionTitle')}
            </span>
            {pendingRevision.before !== '' && (
              <p className="rounded border border-outline-variant bg-surface-container-lowest p-space-xs font-body-sm text-body-sm text-on-surface-variant line-through">
                {pendingRevision.before}
              </p>
            )}
            <p className="rounded border border-navy/25 bg-navy/10 p-space-xs font-body-sm text-body-sm text-on-surface">
              {pendingRevision.after}
            </p>
            <div className="flex justify-end gap-space-xs">
              <button
                type="button"
                onClick={() => {
                  rejectRevision();
                  appendAi(t('revisionRejected'));
                }}
                className="h-8 rounded border border-outline-variant px-space-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
              >
                {t('reject')}
              </button>
              <button
                type="button"
                onClick={() => {
                  acceptRevision();
                  appendAi(t('revisionApplied'));
                }}
                className="h-8 rounded-pill bg-indigo px-space-sm font-label-md text-label-md text-on-indigo hover:bg-indigo-deep"
              >
                {t('accept')}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-space-xs px-space-md pb-space-xs">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={sending}
            onClick={() => submit(s)}
            className="rounded-full border border-navy/40 px-space-sm py-1 font-body-sm text-body-sm text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="flex gap-space-xs border-t border-outline-variant p-space-md"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('placeholder')}
          disabled={sending}
          aria-label={t('placeholder')}
          className="h-10 min-w-0 flex-1 rounded border border-outline-variant bg-surface-container-lowest px-space-sm font-body-md text-body-md outline-none placeholder:text-on-surface-variant focus:border-navy"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          title={t('send')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-indigo text-on-indigo hover:bg-indigo-deep disabled:opacity-50"
        >
          <Icon name="send" size="sm" />
        </button>
      </form>
    </aside>
  );
}
