'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { useAssistantStore } from '@/stores/useAssistantStore';

export function AssistantFab() {
  const t = useTranslations('assistant');
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  if (open) return null;
  return (
    <button
      type="button"
      data-assistant-ui
      onClick={() => setOpen(true)}
      title={t('title')}
      aria-label={t('title')}
      className="fixed bottom-space-lg right-space-lg z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white shadow-lg transition-colors hover:bg-navy-deep"
    >
      <Icon name="auto_awesome" size="md" />
    </button>
  );
}
