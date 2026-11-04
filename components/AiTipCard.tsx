'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSession } from '@/lib/session';
import { useAssistantStore } from '@/stores/useAssistantStore';
import { Icon } from '@/components/Icon';

const KEY = (userId: string) => `licits-ai-tip:${userId}`;
const SHOW_AFTER_MS = 1500;

/**
 * Small first-visit card, bottom right above the assistant button: how to
 * connect ChatGPT or Claude to the user's tenders. Shown once per account,
 * after onboarding (it lives inside RequireOnboarding), and never again once
 * closed or followed. Hidden while the in-app assistant panel is open.
 */
export function AiTipCard() {
  const t = useTranslations('aiTip');
  const session = useSession();
  const assistantOpen = useAssistantStore((s) => s.open);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [address, setAddress] = useState('https://licits.com/api/mcp');

  const userId = session.status === 'in' ? session.user.id : null;

  useEffect(() => {
    if (!userId) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(KEY(userId)) !== null;
    } catch {
      /* storage blocked: show it, it just may come back next visit */
    }
    if (seen) return;
    setAddress(`${window.location.origin}/api/mcp`);
    const timer = window.setTimeout(() => {
      setMounted(true);
      // A beat later, so the slide-in transition has a starting point.
      window.setTimeout(() => setVisible(true), 30);
    }, SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [userId]);

  if (!mounted || assistantOpen) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      if (userId) window.localStorage.setItem(KEY(userId), new Date().toISOString());
    } catch {
      /* storage blocked: nothing to remember */
    }
    window.setTimeout(() => setMounted(false), 200);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address is selectable on screen */
    }
  };

  return (
    <aside
      data-assistant-ui
      role="complementary"
      aria-label={t('title')}
      className={`fixed bottom-[84px] right-space-lg z-[55] w-[min(340px,calc(100vw-2.5rem))] rounded-card border border-line bg-raised p-4 shadow-lift-2 transition-[opacity,transform] duration-200 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-indigo-soft text-indigo-text">
          <Icon name="hub" size="md" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium leading-[20px] tracking-[-0.1px] text-ink">{t('title')}</h2>
          <p className="mt-1 text-[13px] leading-[19px] text-ink-2">{t('body')}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('close')}
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunk hover:text-ink"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>

      <ol className="mt-3 grid gap-1.5 text-[13px] leading-[19px] text-ink-2">
        {(['step1', 'step2', 'step3'] as const).map((k, i) => (
          <li key={k} className="flex gap-2">
            <span className="tnum font-mono text-[12px] leading-[19px] text-muted">{i + 1}</span>
            <span>{t(k)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex items-center gap-2 rounded-field border border-line bg-surface py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{address}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-pill border border-line-strong px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-sunk"
        >
          <Icon name={copied ? 'check' : 'content_copy'} size="xs" />
          {copied ? t('copied') : t('copy')}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Link
          href="/docs/mcp"
          target="_blank"
          onClick={dismiss}
          className="inline-flex h-9 items-center rounded-pill bg-indigo px-4 text-[13px] font-medium text-on-indigo transition-colors hover:bg-indigo-deep"
        >
          {t('cta')}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="text-[13px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {t('later')}
        </button>
      </div>
    </aside>
  );
}
