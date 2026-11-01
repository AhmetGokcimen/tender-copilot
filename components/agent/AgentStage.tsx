'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Icon } from '@/components/Icon';

export type AgentFact = { label: string; value: string; tone?: 'ok' | 'warn' | 'risk' };

/** Widths of the text lines on the page, in %, and which ones the agent "keeps". */
const LINES = [
  { w: 62, keep: false },
  { w: 88, keep: true },
  { w: 74, keep: false },
  { w: 93, keep: false },
  { w: 58, keep: true },
  { w: 81, keep: false },
  { w: 69, keep: true },
  { w: 90, keep: false },
  { w: 47, keep: false },
  { w: 77, keep: true },
  { w: 64, keep: false },
];

/**
 * What the user sees while an agent works (reading a website, looking a
 * company up at ANAF, scanning a document). A page drawn in the site's dot
 * language is swept by a reading beam; lines it "keeps" light up in the
 * brand colours. Stages tick off while the request runs, then the facts
 * the agent actually found appear one by one. Purely visual work only
 * runs while the overlay is open; reduced motion gets a still page.
 */
export function AgentStage({
  icon,
  title,
  subject,
  stages,
  running,
  facts = [],
  note,
  error,
  onClose,
  closeLabel,
}: {
  icon: string;
  title: string;
  subject: string;
  stages: string[];
  running: boolean;
  facts?: AgentFact[];
  note?: string;
  error?: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const [stage, setStage] = useState(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!running) return;
    setStage(0);
    const id = window.setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 1300);
    return () => window.clearInterval(id);
  }, [running, stages.length]);

  useEffect(() => {
    if (running) {
      setShown(0);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= facts.length) window.clearInterval(id);
    }, 160);
    return () => window.clearInterval(id);
  }, [running, facts.length]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-paper/85 px-4 backdrop-blur-[6px]">
      <div
        role="status"
        aria-live="polite"
        className="agent-in grid w-full max-w-2xl grid-cols-1 overflow-hidden rounded-card border border-line bg-raised shadow-lift-2 sm:grid-cols-[220px_minmax(0,1fr)]"
      >
        {/* The page being read */}
        <div className="relative hidden overflow-hidden border-r border-line bg-sunk/60 p-5 sm:block">
          <div className="relative h-full min-h-[260px] rounded-[10px] border border-line bg-raised px-4 py-5 shadow-lift-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo/70" />
              <span className="h-1.5 w-16 rounded-full bg-line-strong/40" />
            </div>
            <div className={clsx('flex flex-col gap-[11px]', !running && !error && 'agent-done')}>
              {LINES.map((l, i) => (
                <span
                  key={i}
                  className={clsx('agent-line relative block h-[5px] rounded-full', l.keep && 'agent-keep')}
                  style={{ width: `${l.w}%`, ['--d' as string]: `${(i / LINES.length) * 2.4}s` }}
                />
              ))}
            </div>
            {running && <span aria-hidden className="agent-beam pointer-events-none absolute inset-x-0 top-0 h-16" />}
            {!running && !error && (
              <span className="agent-stamp absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-indigo text-on-indigo shadow-lift-1">
                <Icon name="check" size="sm" />
              </span>
            )}
          </div>
        </div>

        {/* What the agent is doing and what it found */}
        <div className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-indigo-text">
              <Icon name={icon} size="md" />
              {running && <span className="map-ping absolute inset-0 rounded-full bg-indigo/25" />}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-medium text-ink">{title}</p>
              <p className="truncate font-mono text-[12px] text-muted">{subject}</p>
            </div>
          </div>

          <ol className="flex flex-col gap-2">
            {stages.map((s, i) => {
              const done = !running || i < stage;
              const active = running && i === stage;
              return (
                <li
                  key={s}
                  className={clsx(
                    'flex items-center gap-2 text-[14px] transition-colors',
                    done || active ? 'text-ink' : 'text-muted/60',
                  )}
                >
                  <Icon
                    name={done && !error ? 'check_circle' : active ? 'progress_activity' : 'radio_button_unchecked'}
                    size="sm"
                    className={clsx(done && !error ? 'text-eligible' : active ? 'animate-spin text-indigo-text' : '')}
                  />
                  {s}
                </li>
              );
            })}
          </ol>

          {!running && facts.length > 0 && (
            <dl className="flex flex-col divide-y divide-line rounded-[10px] border border-line">
              {facts.slice(0, shown).map((f) => (
                <div key={f.label} className="chip-in flex items-baseline justify-between gap-3 px-3 py-1.5">
                  <dt className="shrink-0 text-[12.5px] text-muted">{f.label}</dt>
                  <dd
                    className={clsx(
                      'min-w-0 truncate text-right text-[13.5px] font-medium',
                      f.tone === 'risk' ? 'text-risk' : f.tone === 'warn' ? 'text-warn' : 'text-ink',
                    )}
                    title={f.value}
                  >
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {!running && note && <p className="rounded-lg bg-indigo-soft px-3 py-2 text-[13.5px] text-indigo-text">{note}</p>}
          {error && <p className="rounded-lg bg-warn-bg px-3 py-2 text-[13.5px] text-warn">{error}</p>}
          {!running && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="self-end rounded-pill bg-indigo px-4 py-2 text-[14px] font-medium text-on-indigo hover:bg-indigo-deep"
            >
              {closeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
