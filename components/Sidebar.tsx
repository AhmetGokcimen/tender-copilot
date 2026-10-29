'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link, usePathname } from '@/i18n/routing';
import { Icon } from './Icon';
import { FlashNumber } from './FlashNumber';
import { MOCK_QUOTA } from '@/lib/mock-data';
import { USE_MOCK } from '@/lib/api';

const ITEMS = [
  { key: 'opportunities', href: '/app', icon: 'grid_view' },
  { key: 'analysis', href: '/app/tenders', icon: 'find_in_page' },
  { key: 'pipeline', href: '/app/pipeline', icon: 'view_kanban' },
  { key: 'archive', href: '/app/archive', icon: 'folder' },
  { key: 'settings', href: '/app/settings', icon: 'settings' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_LS_KEY = 'ofera-sidebar-collapsed';

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  // Collapsed by default; the layout reads the same width from --sbw.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_LS_KEY);
    const next = stored === null ? true : stored !== '0';
    setCollapsed(next);
    document.documentElement.style.setProperty('--sbw', next ? '4rem' : '18rem');
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_LS_KEY, next ? '1' : '0');
      document.documentElement.style.setProperty('--sbw', next ? '4rem' : '18rem');
      return next;
    });
  };



  const activeMobileRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    activeMobileRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  const quotaPct = Math.round((MOCK_QUOTA.used / MOCK_QUOTA.total) * 100);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 z-50 hidden h-full flex-col justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-16' : 'w-72',
        )}
      >
        <div className="flex flex-col">
          <div
            className={clsx(
              'flex flex-col gap-space-sm bg-surface-container-lowest p-space-md',
              collapsed && 'items-center px-space-xs',
            )}
          >
            <div className={clsx('flex items-center gap-space-sm', collapsed && 'justify-center')}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy font-headline-sm text-headline-sm font-bold text-white">
                O
              </span>
              {!collapsed && (
                <>
                  <span className="whitespace-nowrap font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">
                    {t('brand')}
                  </span>
                  <span className="rounded bg-surface-container-high px-space-xs py-0.5 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface">
                    {t('tag')}
                  </span>
                </>
              )}
            </div>
            {!collapsed && (
              <div className="flex items-center gap-space-xs">
                {USE_MOCK ? (
                  <span className="whitespace-nowrap rounded-full border border-warn/30 bg-warn-bg px-space-xs py-px font-label-sm text-label-sm font-medium text-warn">
                    {t('mockNote')}
                  </span>
                ) : (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-on-tertiary-container" />
                    <span className="whitespace-nowrap font-code-sm text-code-sm font-medium text-on-tertiary-container">
                      {t('sync')}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <nav className={clsx('flex flex-col gap-space-xs py-space-sm', collapsed ? 'px-space-xs' : 'px-space-md')}>
            {ITEMS.map((item) => (
              <Link
                key={item.key}
                data-assistant={`nav-${item.key}`}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                title={collapsed ? t(item.key) : undefined}
                href={item.href}
                className={clsx(
                  'group relative flex items-center rounded px-space-md py-space-sm font-body-md text-body-md transition-colors',
                  collapsed ? 'justify-center' : 'gap-space-md',
                  isActive(pathname, item.href)
                    ? 'bg-primary-container font-semibold text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                )}
              >
                <Icon name={item.icon} size="sm" />
                {!collapsed && <span className="whitespace-nowrap">{t(item.key)}</span>}
                {collapsed && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-navy px-space-xs py-0.5 font-label-sm text-label-sm text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                  >
                    {t(item.key)}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className={clsx('px-space-md', collapsed && 'px-space-xs')}>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              title={collapsed ? t('expand') : t('collapse')}
              aria-label={collapsed ? t('expand') : t('collapse')}
              data-assistant="nav-collapse"
              className="flex h-9 w-full items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size="sm" />
            </button>
          </div>
        </div>
        <div
          className={clsx(
            'flex flex-col gap-space-md bg-surface-container-low',
            collapsed ? 'items-center p-space-xs' : 'p-space-md',
          )}
        >
          {collapsed ? (
            <span
              title={t('quotaUsed', { used: MOCK_QUOTA.used, total: MOCK_QUOTA.total })}
              className="tnum py-space-xs font-code-sm text-code-sm font-semibold text-navy"
            >
              {MOCK_QUOTA.used}/{MOCK_QUOTA.total}
            </span>
          ) : (
            <div className="rounded bg-surface-container-lowest p-space-sm shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <div className="mb-space-xs flex items-center justify-between">
                <span className="whitespace-nowrap font-label-sm text-label-sm font-semibold uppercase text-on-surface-variant">
                  {t('quotaTitle')}
                </span>
                <FlashNumber
                  value={`${MOCK_QUOTA.used}/${MOCK_QUOTA.total}`}
                  className="tnum font-code-sm text-code-sm font-semibold text-navy"
                />
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-navy" style={{ width: `${quotaPct}%` }} />
              </div>
              <p className="mt-space-xs whitespace-nowrap font-label-sm text-label-sm text-on-surface-variant">
                {t('quotaUsed', { used: MOCK_QUOTA.used, total: MOCK_QUOTA.total })}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile / tablet top bar */}
      <div className="sticky top-0 z-40 border-b border-outline-variant bg-surface-container-lowest lg:hidden">
        <div className="flex items-center gap-space-sm px-margin py-space-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-navy font-headline-sm text-body-md font-bold text-white">
            O
          </span>
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">
            {t('brand')}
          </span>
          <span className="rounded bg-surface-container-high px-space-xs py-0.5 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface">
            {t('tag')}
          </span>
          {USE_MOCK && (
            <span className="ml-auto rounded-full border border-warn/30 bg-warn-bg px-space-xs py-px font-label-sm text-label-sm font-medium text-warn">
              {t('mockNote')}
            </span>
          )}
        </div>
        <nav className="thin-scroll flex gap-space-xs overflow-x-auto px-margin pb-space-sm">
          {ITEMS.map((item) => (
            <Link
              key={item.key}
              data-assistant={`nav-${item.key}`}
              ref={isActive(pathname, item.href) ? activeMobileRef : undefined}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              href={item.href}
              className={clsx(
                'flex shrink-0 items-center gap-1 rounded-full border px-space-sm py-1 font-body-sm text-body-sm',
                isActive(pathname, item.href)
                  ? 'border-primary-container bg-primary-container font-semibold text-on-primary'
                  : 'border-outline-variant text-on-surface-variant',
              )}
            >
              <Icon name={item.icon} size="xs" />
              <span>{t(item.key)}</span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
