'use client';

import { memo, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ROMANIA_GRID, ROMANIA_MASK } from '@/lib/romania-mask';
import { CITIES, countyKey } from '@/lib/ro-cities';

type Cell = { x: number; y: number; county: string };

/**
 * Splits the dotted map of Romania into counties by giving each dot to the
 * nearest county seat. The borders are approximate (there are no county
 * outlines in the dot grid), which is enough to find a county by eye.
 */
function buildCells(): Cell[] {
  const { cols, rows, step, width, height } = ROMANIA_GRID;
  const bytes = Uint8Array.from(atob(ROMANIA_MASK), (ch) => ch.charCodeAt(0));
  const seats = CITIES.map((c) => ({ county: c.county, x: (c.x / 100) * width, y: (c.y / 100) * height }));
  const cells: Cell[] = [];
  for (let i = 0; i < cols * rows; i++) {
    if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
    const x = step / 2 + (i % cols) * step;
    const y = step / 2 + Math.floor(i / cols) * step;
    let best = seats[0];
    let bestD = Infinity;
    for (const s of seats) {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    cells.push({ x, y, county: best.county });
  }
  return cells;
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
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={4.4} />
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
  const groups = useMemo(() => {
    const by = new Map<string, Cell[]>();
    for (const c of buildCells()) by.set(c.county, [...(by.get(c.county) ?? []), c]);
    return [...by.entries()];
  }, []);
  const [hover, setHover] = useState<string | null>(null);
  const picked = useMemo(() => new Set(value.map(countyKey)), [value]);
  const all = value.length === 0;
  const names = useMemo(() => new Map(CITIES.map((c) => [countyKey(c.county), c.county])), []);

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
      </svg>
      <p className="h-5 text-[13px] text-ink-2" aria-live="polite">
        {hover ? names.get(hover) : ''}
      </p>
    </div>
  );
}
