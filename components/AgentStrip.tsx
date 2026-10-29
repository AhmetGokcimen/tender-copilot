'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import type { AgentId, AgentState } from '@/lib/types';

export const AGENT_ORDER: AgentId[] = ['spec', 'eligibility', 'legal', 'writer', 'risk'];

function useReducedMotion(): boolean {
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  return reduced;
}

function NodeGlyph({ state }: { state: AgentState }) {
  const dim = 18;
  if (state === 'done') {
    return (
      <span
        aria-hidden
        className="flex items-center justify-center rounded-full bg-success"
        style={{ width: dim, height: dim }}
      >
        <svg viewBox="0 0 12 12" width={dim - 8} height={dim - 8} aria-hidden>
          <path
            d="M2.5 6.5 5 9 9.5 3.5"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === 'active') {
    return (
      <svg width={dim} height={dim} viewBox="0 0 20 20" aria-hidden className="block">
        <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(11,19,43,0.25)" strokeWidth="1" />
        <g className="agent-ring-rotor">
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="#0B132B"
            strokeWidth="1"
            strokeDasharray="14 36.3"
            strokeLinecap="round"
          />
        </g>
        <circle cx="10" cy="10" r="2" fill="#0B132B" />
      </svg>
    );
  }
  return (
    <span
      aria-hidden
      className="rounded-full border border-outline-variant bg-surface-container-lowest"
      style={{ width: dim, height: dim }}
    />
  );
}

/**
 * Agent pipeline (CI-style): five equal grid cells, all nodes on one
 * horizontal axis. Each cell owns a fixed-height node row the connector
 * track aligns to, so label wrapping never shifts siblings. The segment
 * behind each completed agent lights up like a circuit trace; the active
 * node carries a slow rotating dash ring plus an elapsed-time readout.
 */
export function AgentStrip({ states }: { states: Record<AgentId, AgentState> }) {
  const t = useTranslations('agents');
  const reduced = useReducedMotion();
  const startsRef = useRef<Partial<Record<AgentId, number>>>({});
  const [now, setNow] = useState(0);
  const anyActive = AGENT_ORDER.some((a) => states[a] === 'active');

  useEffect(() => {
    for (const a of AGENT_ORDER) {
      if (states[a] === 'active' && startsRef.current[a] == null) {
        startsRef.current[a] = Date.now();
      } else if (states[a] !== 'active') {
        delete startsRef.current[a];
      }
    }
  });

  useEffect(() => {
    if (!anyActive || reduced) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [anyActive, reduced]);

  return (
    <div className="thin-scroll w-full overflow-x-auto">
      <ol className="grid min-w-[440px] grid-cols-5" aria-label="Agent pipeline">
        {AGENT_ORDER.map((agent, i) => {
          const state = states[agent];
          const started = startsRef.current[agent];
          return (
            <li key={agent} className="relative flex min-w-0 flex-col items-center">
              {i < AGENT_ORDER.length - 1 && (
                <span aria-hidden className="absolute left-1/2 top-3 h-px w-full">
                  <span className="block h-full w-full bg-outline-variant/70" />
                  <span
                    className={clsx(
                      'absolute inset-0 origin-left bg-navy transition-transform duration-500 ease-linear',
                      state === 'done' ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </span>
              )}
              <span className="relative flex h-6 items-center justify-center">
                <NodeGlyph state={state} />
              </span>
              <span
                className={clsx(
                  'mt-1 min-h-[2rem] px-1 text-center font-label-md text-label-md leading-tight',
                  state === 'active'
                    ? 'font-semibold text-on-surface'
                    : 'text-on-surface-variant',
                )}
              >
                {t(agent)}
              </span>
              <span className="tnum min-h-4 font-code-sm text-code-sm text-navy">
                {state === 'active' && started != null && !reduced
                  ? `${(Math.max(0, now - started) / 1000).toFixed(1)}s`
                  : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
