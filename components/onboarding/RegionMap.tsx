'use client';

import { memo, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ROMANIA_GRID, ROMANIA_MASK } from '@/lib/romania-mask';
import { DOT_COUNTY } from '@/lib/romania-counties';
import { COUNTIES } from '@/lib/fx';
import { countyKey } from '@/lib/ro-cities';

type Cell = { x: number; y: number; county: string };

/**
 * Gives each dot of the map its county, from real county borders (see
 * scripts/gen-romania-counties.js), and the short border segments between
 * dots of different counties so the outlines can be drawn.
 */
function buildMap(): { cells: Cell[]; borders: string } {
  const { cols, rows, step } = ROMANIA_GRID;
  const bytes = Uint8Array.from(atob(ROMANIA_MASK), (ch) => ch.charCodeAt(0));
  const cells: Cell[] = [];
  const at = new Map<number, string>();
  for (let i = 0, n = 0; i < cols * rows; i++) {
    if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
    const county = COUNTIES[DOT_COUNTY.charCodeAt(n++) - 48];
    cells.push({ x: step / 2 + (i % cols) * step, y: step / 2 + Math.floor(i / cols) * step, county });
    at.set(i, county);
  }
  const h = step / 2;
  let borders = '';
  for (let i = 0; i < cols * rows; i++) {
    const c = at.get(i);
    if (!c) continue;
    const x = step / 2 + (i % cols) * step;
    const y = step / 2 + Math.floor(i / cols) * step;
    const right = (i % cols) < cols - 1 ? at.get(i + 1) : undefined;
    const down = at.get(i + cols);
    if (right && right !== c) borders += `M${x + h} ${y - h}V${y + h}`;
    if (down && down !== c) borders += `M${x - h} ${y + h}H${x + h}`;
  }
  return { cells, borders };
}

const FILL = { on: 'fill-indigo', hot: 'fill-indigo/55', all: 'fill-indigo/25', off: 'fill-line-strong/35' };

/** One county's dots; memoised so hovering re-renders only the counties that change. */
const CountyDots = memo(function CountyDots({
  dots,
  state,
  onEnter,
  onClick,
}: {
  dots: Cell[];
  state: keyof typeof FILL;
  onEnter: () => void;
  onClick: () => void;
}) {
  return (
    <g className={clsx('cursor-pointer transition-colors', FILL[state])} onMouseEnter={onEnter} onClick={onClick}>
      {dots.map((d) => (
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={3.9} />
      ))}
    </g>
  );
});

/**
 * Romania as a dot map. Picked counties are filled; hovering one names it.
 * Clicking a county toggles it, the same as its chip in the list above.
 * With nothing picked the whole country is lightly filled.
 */
export function RegionMap({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { groups, borders } = useMemo(() => {
    const { cells, borders } = buildMap();
    const by = new Map<string, Cell[]>();
    for (const c of cells) by.set(c.county, [...(by.get(c.county) ?? []), c]);
    return { groups: [...by.entries()], borders };
  }, []);
  const [hover, setHover] = useState<string | null>(null);
  const picked = useMemo(() => new Set(value.map(countyKey)), [value]);
  const all = value.length === 0;
  const names = useMemo(() => new Map(COUNTIES.map((c) => [countyKey(c), c])), []);

  const toggle = (county: string) => {
    const k = countyKey(county);
    const exists = value.some((v) => countyKey(v) === k);
    onChange(exists ? value.filter((v) => countyKey(v) !== k) : [...value, county]);
  };

  return (
    <div className="flex flex-col items-center gap-2 rounded-[10px] bg-sunk/50 p-3">
      <svg
        viewBox={`0 0 ${ROMANIA_GRID.width} ${ROMANIA_GRID.height}`}
        className="h-auto w-full max-w-[560px]"
        role="group"
        aria-label="Map of Romania"
        onMouseLeave={() => setHover(null)}
      >
        {groups.map(([county, dots]) => {
          const key = countyKey(county);
          return (
            <CountyDots
              key={key}
              dots={dots}
              state={picked.has(key) ? 'on' : hover === key ? 'hot' : all ? 'all' : 'off'}
              onEnter={() => setHover(key)}
              onClick={() => toggle(county)}
            />
          );
        })}
        <path d={borders} className="pointer-events-none stroke-ink/25" strokeWidth={1.2} strokeLinecap="round" fill="none" />
      </svg>
      <p className="h-5 text-[13px] text-ink-2" aria-live="polite">
        {hover ? names.get(hover) : ''}
      </p>
    </div>
  );
}
