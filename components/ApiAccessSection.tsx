'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { USE_MOCK } from '@/lib/api';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/lib/queries';
import { Icon } from '@/components/Icon';
import { INPUT } from '@/components/ui/form';

type Tab = 'claudeCode' | 'desktop' | 'cursor' | 'rest';

const TABS: Tab[] = ['claudeCode', 'desktop', 'cursor', 'rest'];
const TAB_KEY: Record<Tab, 'tabClaudeCode' | 'tabDesktop' | 'tabCursor' | 'tabRest'> = {
  claudeCode: 'tabClaudeCode',
  desktop: 'tabDesktop',
  cursor: 'tabCursor',
  rest: 'tabRest',
};

/** The config to paste for each client; the key is the one just created, else a placeholder. */
function snippet(tab: Tab, origin: string, key: string): string {
  const mcp = `${origin}/api/mcp`;
  switch (tab) {
    case 'claudeCode':
      return `claude mcp add --transport http licits ${mcp} --header "Authorization: Bearer ${key}"`;
    case 'desktop':
      return JSON.stringify(
        {
          mcpServers: {
            licits: {
              command: 'npx',
              args: ['-y', 'mcp-remote', mcp, '--header', 'Authorization:${LICITS_AUTH}'],
              env: { LICITS_AUTH: `Bearer ${key}` },
            },
          },
        },
        null,
        2,
      );
    case 'cursor':
      return JSON.stringify(
        { mcpServers: { licits: { url: mcp, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2,
      );
    case 'rest':
      return `curl -H "Authorization: Bearer ${key}" "${origin}/api/v1/tenders?limit=5"`;
  }
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations('apiAccess');
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      /* clipboard blocked: the text is still selectable on screen */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-pill border border-line-strong px-space-sm font-label-md text-label-md text-on-surface hover:bg-surface-container"
    >
      <Icon name={done ? 'check' : 'content_copy'} size="sm" />
      {done ? t('copied') : t('copy')}
    </button>
  );
}

/**
 * Settings section: create and revoke API keys, and copy the config that
 * connects an AI assistant (MCP) or a script (REST) to the user's tenders.
 */
export function ApiAccessSection() {
  const t = useTranslations('apiAccess');
  const locale = useLocale();
  const { data } = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();

  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const [created, setCreated] = useState<{ id: number; secret: string } | null>(null);
  const secret = created?.secret ?? null;
  const [confirming, setConfirming] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('claudeCode');
  const [origin, setOrigin] = useState('https://licits.com');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const full = data ? data.keys.length >= data.max_keys : false;

  const submit = async () => {
    setError(null);
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        expires_in_days: days ? Number(days) : null,
      });
      setCreated({ id: res.key.id, secret: res.secret });
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section
      data-assistant="settings-api"
      className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
    >
      <header className="flex flex-col gap-1">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('title')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('subtitle')}</p>
        {USE_MOCK && (
          <p className="font-body-md text-body-md text-on-surface-variant">{t('mockNote')}</p>
        )}
        {data && (
          <p className="font-label-md text-label-md text-on-surface-variant">
            {t('usage', { used: data.used_today, limit: data.daily_limit })}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-space-sm">
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">{t('keysTitle')}</h3>
        {data && data.keys.length === 0 && (
          <p className="font-body-md text-body-md text-on-surface-variant">{t('none')}</p>
        )}
        {data?.keys.map((k) => (
          <div
            key={k.id}
            className="flex flex-wrap items-center gap-space-sm rounded-lg border border-line-strong px-space-md py-space-sm"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                {k.name} <span className="font-mono font-normal text-on-surface-variant">{k.prefix}…</span>
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {t('created', { date: fmt(k.created_at) })} ·{' '}
                {k.last_used_at ? t('lastUsed', { date: fmt(k.last_used_at) }) : t('neverUsed')}
                {k.expires_at ? ` · ${t('expires', { date: fmt(k.expires_at) })}` : ''}
              </span>
            </div>
            {confirming === k.id ? (
              <button
                type="button"
                disabled={revoke.isPending}
                onClick={() => {
                  revoke.mutate(k.id, {
                    onSuccess: () => setCreated((c) => (c?.id === k.id ? null : c)),
                    onSettled: () => setConfirming(null),
                  });
                }}
                className="inline-flex h-8 items-center rounded-pill bg-error px-space-sm font-label-md text-label-md text-on-error disabled:opacity-50"
              >
                {t('confirmRevoke')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(k.id)}
                className="inline-flex h-8 items-center rounded-pill border border-line-strong px-space-sm font-label-md text-label-md text-on-surface hover:bg-surface-container"
              >
                {t('revoke')}
              </button>
            )}
          </div>
        ))}
      </div>

      {secret && (
        <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container p-space-md">
          <h3 className="font-label-md text-label-md font-semibold text-on-surface">{t('createdTitle')}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t('createdBody')}</p>
          <div className="flex items-center gap-space-sm">
            <code className="min-w-0 flex-1 break-all rounded bg-surface-container-lowest px-space-sm py-space-xs font-mono text-[13px] text-on-surface">
              {secret}
            </code>
            <CopyButton text={secret} />
          </div>
        </div>
      )}

      {full ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          {t('limitReached', { max: data?.max_keys ?? 5 })}
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-space-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && !create.isPending) void submit();
          }}
        >
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
            {t('name')}
            <input
              value={name}
              maxLength={80}
              placeholder={t('namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 font-label-md text-label-md font-semibold text-on-surface">
            {t('expiry')}
            <select value={days} onChange={(e) => setDays(e.target.value)} className={INPUT}>
              <option value="">{t('never')}</option>
              <option value="30">{t('days30')}</option>
              <option value="90">{t('days90')}</option>
              <option value="365">{t('days365')}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={!name.trim() || create.isPending}
            className="inline-flex h-11 items-center gap-space-xs rounded-pill bg-indigo px-space-md font-label-md text-label-md text-on-indigo hover:bg-indigo-deep disabled:opacity-50"
          >
            <Icon name="key" size="sm" />
            {create.isPending ? t('creating') : t('create')}
          </button>
        </form>
      )}
      {error && <p className="font-body-md text-body-md text-error">{error}</p>}

      <div className="flex flex-col gap-space-sm border-t border-line-strong pt-space-md">
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">{t('connectTitle')}</h3>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('connectBody')}</p>
        <div role="tablist" className="flex flex-wrap gap-space-xs">
          {TABS.map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? 'h-8 rounded-pill bg-indigo px-space-sm font-label-md text-label-md text-on-indigo'
                  : 'h-8 rounded-pill border border-line-strong px-space-sm font-label-md text-label-md text-on-surface hover:bg-surface-container'
              }
            >
              {t(TAB_KEY[id])}
            </button>
          ))}
        </div>
        <div className="flex items-start gap-space-sm">
          <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-surface-container p-space-md font-mono text-[12.5px] text-on-surface">
            {snippet(tab, origin, secret ?? t('yourKey'))}
          </pre>
          <CopyButton text={snippet(tab, origin, secret ?? t('yourKey'))} />
        </div>
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">{t('toolsTitle')}</h3>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('tools')}</p>
      </div>
    </section>
  );
}
