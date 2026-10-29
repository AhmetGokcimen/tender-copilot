'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../Icon';
import { useAssistantStore } from '@/stores/useAssistantStore';

export function AssistantTooltip() {
  const t = useTranslations('assistant');
  const tooltip = useAssistantStore((s) => s.tooltip);
  const dismissTooltip = useAssistantStore((s) => s.dismissTooltip);
  if (!tooltip) return null;
  return (
    <div
      data-assistant-ui
      role="status"
      style={{ left: tooltip.x, top: tooltip.y }}
      className="fixed z-[90] w-[280px] rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm shadow-lg"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
          {t('guideCaption')}
        </span>
        <button
          type="button"
          onClick={dismissTooltip}
          title={t('close')}
          className="rounded p-0.5 text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="close" size="xs" />
        </button>
      </div>
      <p className="font-body-sm text-body-sm leading-relaxed text-on-surface">{tooltip.text}</p>
    </div>
  );
}
