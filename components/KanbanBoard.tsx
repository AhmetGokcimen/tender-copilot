'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Icon } from './Icon';
import { MatchChip } from './MatchChip';
import { FlashNumber } from './FlashNumber';
import {
  COLUMN_TO_STATUS,
  STATUS_TO_COLUMN,
  type KanbanColumn,
  type TenderWithState,
} from '@/lib/types';
import { formatDaysLeft, formatRON, tenderTitle } from '@/lib/format';
import { usePipelineStore } from '@/stores/usePipelineStore';

const COLUMNS: KanbanColumn[] = ['new', 'preparing', 'submitted', 'archived'];
const COL_KEYS: Record<KanbanColumn, 'colNew' | 'colPreparing' | 'colSubmitted' | 'colArchived'> = {
  new: 'colNew',
  preparing: 'colPreparing',
  submitted: 'colSubmitted',
  archived: 'colArchived',
};

function KanbanCard({
  tender,
  overlay = false,
}: {
  tender: TenderWithState;
  overlay?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('kanban');
  const untrack = usePipelineStore((s) => s.untrack);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tender.external_id,
    disabled: overlay,
  });
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : { transform: CSS.Translate.toString(transform) }}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      className={`flex cursor-grab flex-col gap-space-xs rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      } ${overlay ? 'rotate-1 shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-space-xs">
        <MatchChip score={tender.state.score} />
        <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
          {tender.external_id}
        </span>
        {!overlay && (
          <button
            type="button"
            title={t('remove')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => untrack(tender.external_id)}
            className="ml-auto rounded p-0.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Icon name="close" size="xs" />
          </button>
        )}
      </div>
      <Link
        href={`/app/tenders/${tender.external_id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="line-clamp-2 font-headline-sm text-body-md font-semibold leading-snug text-on-surface hover:underline"
      >
        {tenderTitle(tender, locale)}
      </Link>
      <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{tender.authority}</p>
      <div className="flex items-center justify-between border-t border-surface-container-low pt-space-xs">
        <span className="tnum font-code-sm text-code-sm font-semibold text-on-surface">
          {formatRON(tender.estimated_value, true)}
        </span>
        <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
          {formatDaysLeft(tender.submission_deadline)}
        </span>
      </div>
    </div>
  );
}

function KanbanColumnView({
  column,
  cards,
  dragging,
}: {
  column: KanbanColumn;
  cards: TenderWithState[];
  dragging: boolean;
}) {
  const t = useTranslations('kanban');
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const total = cards.reduce((s, c) => s + (c.estimated_value ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex min-h-[420px] w-72 shrink-0 flex-col gap-space-sm rounded-xl border-2 p-space-sm transition-colors lg:w-auto lg:flex-1',
        isOver
          ? 'border-solid border-navy/70 bg-surface-container'
          : dragging
            ? 'border-dashed border-navy/30 bg-surface-container-low'
            : 'border-transparent bg-surface-container-low',
      )}
    >
      <div className="flex items-center justify-between px-space-xs pt-space-xs">
        <h2 className="font-headline-sm text-headline-sm uppercase tracking-wide text-on-surface">
          {t(COL_KEYS[column])}
        </h2>
        <FlashNumber
          value={String(cards.length)}
          className="tnum rounded-full bg-surface-container-high px-space-xs py-px font-code-sm text-code-sm font-semibold text-on-surface"
        />
      </div>
      <p className="tnum px-space-xs font-code-sm text-code-sm text-on-surface-variant">
        {t('totalValue')}: <FlashNumber value={formatRON(total, true)} className="tnum" />
      </p>
      <div className="thin-scroll flex max-h-[62vh] flex-col gap-space-sm overflow-y-auto">
        {cards.map((c) => (
          <KanbanCard key={c.external_id} tender={c} />
        ))}
        {cards.length === 0 && (
          <p className="rounded-lg border border-dashed border-outline-variant px-space-md py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
            {t('emptyColumn')}
          </p>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ tenders }: { tenders: TenderWithState[] }) {
  const statuses = usePipelineStore((s) => s.statuses);
  const setStatus = usePipelineStore((s) => s.setStatus);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const columnOf = (id: string): KanbanColumn | undefined => {
    const card = tenders.find((x) => x.external_id === id);
    if (!card) return undefined;
    const eff = statuses[card.external_id] ?? card.state.status;
    return STATUS_TO_COLUMN[eff];
  };

  const grouped = useMemo(() => {
    const g: Record<KanbanColumn, TenderWithState[]> = {
      new: [],
      preparing: [],
      submitted: [],
      archived: [],
    };
    for (const x of tenders) {
      const eff = statuses[x.external_id] ?? x.state.status;
      g[STATUS_TO_COLUMN[eff]].push(x);
    }
    for (const col of COLUMNS) g[col].sort((a, b) => (b.state.score ?? -1) - (a.state.score ?? -1));
    return g;
  }, [tenders, statuses]);

  const activeTender = activeId ? tenders.find((x) => x.external_id === activeId) : undefined;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const tenderId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : undefined;
    if (!overId) return;
    const target: KanbanColumn | undefined = (COLUMNS as string[]).includes(overId)
      ? (overId as KanbanColumn)
      : columnOf(overId);
    if (target) setStatus(tenderId, COLUMN_TO_STATUS[target]);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="thin-scroll flex gap-space-md overflow-x-auto pb-space-sm lg:grid lg:grid-cols-4 lg:overflow-visible">
        {COLUMNS.map((col) => (
          <KanbanColumnView
            key={col}
            column={col}
            cards={grouped[col]}
            dragging={activeId !== null}
          />
        ))}
      </div>
      <DragOverlay>{activeTender ? <KanbanCard tender={activeTender} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
