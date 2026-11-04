'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentId } from '@/lib/types';
import { collectDomContext } from '@/lib/dom-context';
import { postAssistant } from '@/lib/assistant-api';
import {
  prefersReducedMotion,
  resolveVisibleTarget,
  scrollAndHighlight,
  tooltipPlacement,
  waitForTarget,
  type TooltipPlacement,
} from '@/lib/assistant-highlight';

export interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  text: string;
  agent?: AgentId;
  /** Page the assistant opened for this answer. */
  navigated?: string;
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
    ctx: { pathname: string; tenderId: string | null; errorText: string; navigate: (path: string) => void },
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
          const history = get()
            .messages.slice(-10)
            .map((m) => ({ role: m.role, text: m.text }));
          const res = await postAssistant({
            question: clean,
            pathname: ctx.pathname,
            tenderId: ctx.tenderId,
            dom,
            history,
          });
          await delay(prefersReducedMotion() ? 0 : 650);
          set((s) => ({
            messages: [
              ...s.messages,
              { id: `${id}-r`, role: 'ai', text: res.message, agent: res.agent, navigated: res.navigate_to ?? undefined },
            ],
            sending: false,
          }));
          if (res.navigate_to) ctx.navigate(res.navigate_to);
          if (res.highlight_selector) {
            // After opening another page the element appears a moment later.
            const el = res.navigate_to ? await waitForTarget(res.highlight_selector) : resolveVisibleTarget(res.highlight_selector);
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
