'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { useAssistantStore } from '@/stores/useAssistantStore';
import { usePathname } from '@/i18n/routing';

export function AssistantFab() {
  const t = useTranslations('assistant');
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const pathname = usePathname();
  // The marketing landing page keeps a single call to action: the waitlist.
  if (open || pathname === '/') return null;
  return (
    <button
      type="button"
      data-assistant-ui
      onClick={() => setOpen(true)}
      title={t('title')}
      aria-label={t('title')}
      className="fixed bottom-space-lg right-space-lg z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-indigo text-on-indigo shadow-lg transition-colors hover:bg-indigo-deep"
    >
      <Icon name="auto_awesome" size="md" />
    </button>
  );
}
