'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JSONContent } from '@tiptap/react';
import type { AgentId, DraftSection } from '@/lib/types';
import { sectionsToTiptap } from '@/lib/doc-convert';

export type DocType = 'technical' | 'financial' | 'duae';

/** One generated document: Tiptap JSON is the canonical edited state. */
export interface WorkspaceDoc {
  key: string;
  doc: DocType;
  tenderId: string;
  content: JSONContent;
  /** h2 titles at generation time (completeness baseline). */
  templateHeads: string[];
  attribution: { head: string; agent: AgentId }[];
  updatedAt: string;
  /** User typed in the editor. */
  edited: boolean;
}

interface GeneratorState {
  docs: Record<string, WorkspaceDoc>;
  /** Bumped on external content changes (regenerate) so the editor reloads. */
  contentVersion: Record<string, number>;
  generating: boolean;
  setDoc: (doc: WorkspaceDoc) => void;
  updateDocContent: (key: string, content: JSONContent) => void;
  setGenerating: (value: boolean) => void;
}

export const outputKey = (tenderId: string, doc: DocType): string => `${tenderId}:${doc}`;

export const useGeneratorStore = create<GeneratorState>()(
  persist(
    (set) => ({
      docs: {},
      contentVersion: {},
      generating: false,
      setDoc: (doc) =>
        set((s) => ({
          docs: { ...s.docs, [doc.key]: doc },
          contentVersion: { ...s.contentVersion, [doc.key]: (s.contentVersion[doc.key] ?? 0) + 1 },
        })),
      updateDocContent: (key, content) =>
        set((s) =>
          s.docs[key] === undefined
            ? s
            : {
                docs: {
                  ...s.docs,
                  [key]: {
                    ...s.docs[key],
                    content,
                    updatedAt: new Date().toISOString(),
                    edited: true,
                  },
                },
              },
        ),
      setGenerating: (generating) => set({ generating }),
    }),
    {
      name: 'ofera-generator',
      version: 4,
      partialize: (s) => ({ docs: s.docs }),
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as {
          outputs?: Record<string, DraftSection[]>;
          edited?: Record<string, boolean>;
          docs?: Record<string, WorkspaceDoc>;
        };
        // v4 shape already — just drop retired keys.
        if (p.docs && !p.outputs) return { docs: p.docs };
        // v2 → v4: Markdown section outputs become workspace documents.
        const docs: Record<string, WorkspaceDoc> = {};
        const now = new Date().toISOString();
        for (const [key, sections] of Object.entries(p.outputs ?? {})) {
          const sep = key.lastIndexOf(':');
          if (sep < 0 || sections.length === 0) continue;
          const tenderId = key.slice(0, sep);
          const doc = key.slice(sep + 1) as DocType;
          if (doc !== 'technical' && doc !== 'financial' && doc !== 'duae') continue;
          docs[key] = {
            key,
            doc,
            tenderId,
            content: sectionsToTiptap(sections),
            templateHeads: sections.map((s) => s.title),
            attribution: sections.map((s) => ({ head: s.title, agent: s.agent })),
            updatedAt: now,
            edited: p.edited?.[key] ?? false,
          };
        }
        return { docs };
      },
    },
  ),
);
