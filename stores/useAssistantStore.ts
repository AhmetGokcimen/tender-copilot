'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentId } from '@/lib/types';
import { collectDomContext } from '@/lib/dom-context';
import { postAssistant, type DocEditContext } from '@/lib/assistant-api';
import { docHeadings, docParagraphs } from '@/lib/doc-convert';
import { DOC_TITLES } from '@/lib/draft-template';
import { useGeneratorStore } from './useGeneratorStore';
import {
  prefersReducedMotion,
  resolveVisibleTarget,
  scrollAndHighlight,
  tooltipPlacement,
  type TooltipPlacement,
} from '@/lib/assistant-highlight';

export interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  text: string;
  agent?: AgentId;
}

export interface TooltipState extends TooltipPlacement {
  text: string;
}

/** Snap targets for the floating widget: corners + edge centers. */
export type DockAnchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';

interface AssistantState {
  open: boolean;
  expanded: boolean;
  anchor: DockAnchor;
  messages: ChatMsg[];
  sending: boolean;
  tooltip: TooltipState | null;
  setOpen: (open: boolean) => void;
  toggleExpanded: () => void;
  setAnchor: (anchor: DockAnchor) => void;
  seedGreeting: (text: string) => void;
  send: (
    text: string,
    ctx: { pathname: string; tenderId: string | null; errorText: string },
  ) => Promise<void>;
  /** Appends a local AI note (revision confirmations) without a round-trip. */
  appendAi: (text: string) => void;
  dismissTooltip: () => void;
  clear: () => void;
}

let highlightTimer: number | undefined;
let tooltipTimer: number | undefined;

function clearTimers() {
  window.clearTimeout(highlightTimer);
  window.clearTimeout(tooltipTimer);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bounded snapshot of the document under revision (tender detail only). */
function collectDocContext(pathname: string): DocEditContext | null {
  if (!pathname.includes('/app/tenders/')) return null;
  const g = useGeneratorStore.getState();
  const doc = g.docEditTarget ? g.docs[g.docEditTarget] : undefined;
  if (!doc) return null;
  return {
    key: doc.key,
    title: DOC_TITLES[doc.doc],
    headings: docHeadings(doc.content).slice(0, 12),
    paragraphs: docParagraphs(doc.content)
      .slice(0, 40)
      .map((p) => p.slice(0, 400)),
  };
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      open: false,
      expanded: false,
      anchor: 'br',
      messages: [],
      sending: false,
      tooltip: null,
      setOpen: (open) => set({ open }),
      toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
      setAnchor: (anchor) => set({ anchor }),
      seedGreeting: (text) => {
        if (get().messages.length === 0) {
          set({ messages: [{ id: 'greeting', role: 'ai', text }] });
        }
      },
      send: async (text, ctx) => {
        const clean = text.trim().slice(0, 500);
        if (!clean || get().sending) return;
        clearTimers();
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        set((s) => ({
          messages: [...s.messages.slice(-49), { id, role: 'user', text: clean }],
          sending: true,
          tooltip: null,
        }));
        try {
          // Fresh DOM + document context on every question.
          const dom = collectDomContext();
          const doc = collectDocContext(ctx.pathname);
          const history = get()
            .messages.slice(-10)
            .map((m) => ({ role: m.role, text: m.text }));
          const res = await postAssistant({
            question: clean,
            pathname: ctx.pathname,
            tenderId: ctx.tenderId,
            dom,
            history,
            doc,
          });
          if (res.revision && doc) {
            useGeneratorStore.getState().setPendingRevision({
              key: doc.key,
              target: res.revision.target,
              before: res.revision.before,
              after: res.revision.after,
              instruction: clean,
            });
          }
          await delay(prefersReducedMotion() ? 0 : 650);
          set((s) => ({
            messages: [
              ...s.messages,
              { id: `${id}-r`, role: 'ai', text: res.message, agent: res.agent },
            ],
            sending: false,
          }));
          if (res.highlight_selector) {
            const el = resolveVisibleTarget(res.highlight_selector);
            if (el) {
              scrollAndHighlight(el);
              highlightTimer = window.setTimeout(
                () => {
                  const p = tooltipPlacement(el);
                  set({ tooltip: { ...p, text: res.message } });
                  tooltipTimer = window.setTimeout(() => set({ tooltip: null }), 12000);
                },
                prefersReducedMotion() ? 50 : 650,
              );
            }
          }
        } catch {
          set((s) => ({
            messages: [...s.messages, { id: `${id}-e`, role: 'ai', text: ctx.errorText }],
            sending: false,
          }));
        }
      },
      appendAi: (text) =>
        set((s) => ({
          messages: [
            ...s.messages.slice(-49),
            { id: `${Date.now()}-n`, role: 'ai', text },
          ],
        })),
      dismissTooltip: () => {
        window.clearTimeout(tooltipTimer);
        set({ tooltip: null });
      },
      clear: () => set({ messages: [], tooltip: null }),
    }),
    {
      name: 'ofera-assistant',
      version: 1,
      partialize: (s) =>
        ({
          messages: s.messages.slice(-50),
          anchor: s.anchor,
          expanded: s.expanded,
        }) as AssistantState,
    },
  ),
);
