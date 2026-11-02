'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import type { AgentId, AgentState } from '@/lib/types';
import { Icon } from './Icon';
import { AGENT_ORDER } from './AgentStrip';

export interface AgentLogEntry {
  agent: AgentId;
  /** Pre-formatted result line from the agent's real output. */
  text: string;
  ms: number;
  failed?: boolean;
}

const AGENT_ICON: Record<AgentId, string> = {
  spec: 'find_in_page',
  eligibility: 'fact_check',
  legal: 'gavel',
  writer: 'edit_note',
  risk: 'shield',
};

/**
 * What the agent that is running is doing right now (rotating task lines that
 * name its real job) with a moving bar, and below it a log line per finished
 * agent built from its actual output: how many requirements it found, how many
 * it could confirm, and so on.
 */
export function AgentWorkbench({
  states,
  log,
}: {
  states: Record<AgentId, AgentState>;
  log: AgentLogEntry[];
}) {
  const t = useTranslations('agents');
  const active = AGENT_ORDER.find((a) => states[a] === 'active');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    setTick(0);
    const id = window.setInterval(() => setTick((n) => n + 1), 2300);
    return () => window.clearInterval(id);
  }, [active]);

  const steps = active ? (t.raw(`activity_${active}`) as string[]) : [];
  const line = steps.length > 0 ? steps[tick % steps.length] : '';

  if (!active && log.length === 0) return null;
  return (
    <div className="flex flex-col gap-space-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md">
      {active && (
        <div className="flex flex-col gap-space-xs" aria-live="polite">
          <div className="flex items-center gap-space-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-indigo-text">
              <Icon name={AGENT_ICON[active]} size="sm" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-label-md text-label-md font-semibold text-on-surface">{t(active)}</p>
              <p key={tick} className="truncate font-body-sm text-body-sm text-on-surface-variant">
                {line}
                <span className="ml-0.5 inline-flex gap-0.5" aria-hidden>
                  <span className="agent-dot">.</span>
                  <span className="agent-dot [animation-delay:200ms]">.</span>
                  <span className="agent-dot [animation-delay:400ms]">.</span>
                </span>
              </p>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-container-high">
            <div className="agent-bar h-full rounded-full bg-indigo" />
          </div>
        </div>
      )}
      {log.length > 0 && (
        <ul className="flex flex-col gap-1">
          {log.map((e) => (
            <li key={e.agent} className="flex items-start gap-space-xs font-body-sm text-body-sm">
              <Icon
                name={e.failed ? 'error' : 'check_circle'}
                size="xs"
                className={clsx('mt-0.5 shrink-0', e.failed ? 'text-error' : 'text-success')}
              />
              <span className="min-w-0 flex-1 text-on-surface">
                <span className="font-semibold">{t(e.agent)}</span>
                <span className="text-on-surface-variant"> · {e.text}</span>
              </span>
              <span className="tnum shrink-0 font-code-sm text-code-sm text-on-surface-variant">
                {(e.ms / 1000).toFixed(1)}s
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
