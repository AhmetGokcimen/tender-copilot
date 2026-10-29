'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { AgentStrip, AGENT_ORDER } from '../AgentStrip';
import type { AgentId, AgentState } from '@/lib/types';
import { Reveal, useInView } from './Reveal';
import { AmbientOrbs } from './AmbientOrbs';

export function ProblemSolution() {
  const t = useTranslations('landing');
  return (
    <section className="relative overflow-hidden bg-surface">
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-space-md px-margin py-space-xl md:grid-cols-2 lg:px-margin-desktop lg:py-24">
        <Reveal
          rise
          className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-error-container text-error">
            <Icon name="report" size="md" />
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">{t('problemTitle')}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t('problemBody')}</p>
        </Reveal>
        <Reveal
          rise
          delayMs={90}
          className="flex flex-col gap-space-sm rounded-xl bg-navy p-space-lg text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-accent">
            <Icon name="auto_awesome" size="md" />
          </span>
          <h2 className="font-headline-md text-headline-md">{t('solutionTitle')}</h2>
          <p className="font-body-lg text-body-lg text-white/80">{t('solutionBody')}</p>
        </Reveal>
      </div>
    </section>
  );
}

const PENDING_STRIP: Record<AgentId, AgentState> = {
  spec: 'pending',
  eligibility: 'pending',
  legal: 'pending',
  writer: 'pending',
  risk: 'pending',
};

const DONE_STRIP: Record<AgentId, AgentState> = {
  spec: 'done',
  eligibility: 'done',
  legal: 'done',
  writer: 'done',
  risk: 'done',
};

/**
 * The real generator pipeline strip, played once when scrolled into view:
 * agents activate in sequence, then stay done. Reduced-motion users see
 * the completed strip with no sequence.
 */
function PlayingStrip() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const [states, setStates] = useState<Record<AgentId, AgentState>>(PENDING_STRIP);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStates(DONE_STRIP);
      return;
    }
    const timers: number[] = [];
    AGENT_ORDER.forEach((agent, i) => {
      timers.push(
        window.setTimeout(() => {
          setStates((prev) => {
            const next = { ...prev };
            const idx = AGENT_ORDER.indexOf(agent);
            AGENT_ORDER.forEach((a, j) => {
              next[a] = j < idx ? 'done' : j === idx ? 'active' : prev[a];
            });
            return next;
          });
        }, 350 + i * 650),
      );
    });
    timers.push(window.setTimeout(() => setStates(DONE_STRIP), 350 + AGENT_ORDER.length * 650));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [inView]);

  return (
    <div ref={ref} data-assistant="landing-agent-strip">
      <AgentStrip states={states} />
    </div>
  );
}

export function AgentsSection() {
  const t = useTranslations('landing');
  const ta = useTranslations('agents');
  const roles: Record<AgentId, string> = {
    spec: t('specRole'),
    eligibility: t('eligibilityRole'),
    legal: t('legalRole'),
    writer: t('writerRole'),
    risk: t('riskRole'),
  };
  return (
    <section id="agents" className="relative scroll-mt-20 overflow-hidden bg-navy text-white">
      <AmbientOrbs variant="dark" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-space-lg px-margin py-space-xl lg:px-margin-desktop lg:py-24">
        <Reveal className="flex max-w-3xl flex-col gap-space-sm">
          <h2 className="font-headline-lg text-headline-lg tracking-tight">{t('agentsTitle')}</h2>
          <p className="font-body-lg text-body-lg text-white/80">{t('agentsBody')}</p>
        </Reveal>
        <Reveal className="rounded-xl bg-surface-container-lowest p-space-lg shadow-lg">
          <PlayingStrip />
        </Reveal>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_ORDER.map((a, i) => (
            <Reveal
              key={a}
              rise
              delayMs={i * 70}
              className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.06] p-space-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.09]"
            >
              <span className="font-headline-sm text-headline-sm">{ta(a)}</span>
              <span className="font-body-md text-body-md text-white/70">{roles[a]}</span>
            </Reveal>
          ))}
          <Reveal
            rise
            delayMs={AGENT_ORDER.length * 70}
            className="flex items-center gap-space-sm rounded-xl border border-dashed border-white/20 p-space-md"
          >
            <Icon name="draw" size="sm" className="shrink-0 text-accent" />
            <span className="font-body-md text-body-md text-white/80">{t('agentsNote')}</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Principles() {
  const t = useTranslations('landing');
  return (
    <section id="principles" className="relative scroll-mt-20 overflow-hidden bg-surface-container-lowest">
      <div className="relative mx-auto flex max-w-6xl flex-col gap-space-md px-margin py-space-xl lg:px-margin-desktop lg:py-24">
        <Reveal className="flex max-w-3xl flex-col gap-space-sm">
          <h2 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            {t('principlesTitle')}
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t('principlesBody')}</p>
        </Reveal>
        <Reveal
          rise
          className="flex max-w-3xl flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface p-space-lg shadow-sm"
        >
          {[t('principle1'), t('principle2'), t('principle3')].map((p) => (
            <div key={p} className="flex items-start gap-space-sm">
              <Icon name="check_circle" size="sm" className="mt-0.5 shrink-0 text-success" />
              <span className="font-body-md text-body-md text-on-surface">{p}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
