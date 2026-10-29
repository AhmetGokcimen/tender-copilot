'use client';

import { useEffect, useRef } from 'react';

const NS = 'http://www.w3.org/2000/svg';
const STRANDS = 18;
const GRAD_ID = 'lichit-ribbon-grad';
const BLUR_ID = 'lichit-ribbon-blur';

/**
 * The hero signal: SVG strands drift in the ribbon gradient, lean toward the
 * cursor, and converge on the left edge of `children` (the hero card).
 * Path data is written straight to the DOM from one rAF loop, never through
 * React state. Reduced motion draws a single static frame.
 */
export function SignalStage({ children }: { children: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const linesRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGGElement>(null);
  const nodeRef = useRef<SVGCircleElement>(null);
  const pingRef = useRef<SVGCircleElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current!;
    const svg = svgRef.current!;
    const lines = linesRef.current!;
    const glow = glowRef.current!;
    const card = cardRef.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const paths: SVGPathElement[] = [];
    const glows: SVGPathElement[] = [];
    const offsets = new Array<number>(STRANDS).fill(0);
    for (let i = 0; i < STRANDS; i++) {
      const edge = Math.abs(i - (STRANDS - 1) / 2) / ((STRANDS - 1) / 2);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', `url(#${GRAD_ID})`);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-width', (2.4 - edge * 1.4).toFixed(2));
      p.setAttribute('opacity', (0.95 - edge * 0.55).toFixed(2));
      const g = document.createElementNS(NS, 'path');
      g.setAttribute('fill', 'none');
      g.setAttribute('stroke', `url(#${GRAD_ID})`);
      g.setAttribute('stroke-width', '7');
      lines.appendChild(p);
      glow.appendChild(g);
      paths.push(p);
      glows.push(g);
    }

    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let mx = 0;
    let my = 0;
    let inside = false;
    let raf = 0;

    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      cx = W - card.offsetWidth - 14;
      cy = H / 2;
      gradRef.current?.setAttribute('x1', '-40');
      gradRef.current?.setAttribute('x2', String(cx));
      for (const c of [nodeRef.current, pingRef.current]) {
        c?.setAttribute('cx', String(cx));
        c?.setAttribute('cy', String(cy));
      }
    };

    const draw = (t: number) => {
      for (let i = 0; i < STRANDS; i++) {
        const y0 = H * 0.04 + i * ((H * 0.92) / (STRANDS - 1));
        const w = reduce ? 0 : Math.sin(t * 0.0006 + i * 0.55) * 14 + Math.sin(t * 0.00037 + i * 1.3) * 6;
        const a = cx * 0.42;
        const b = cx * 0.74;
        const y1 = y0 + w;
        const y2 = cy + (y0 - cy) * 0.16 + w * 0.3;
        let target = 0;
        if (inside) {
          const dx = a - mx;
          const dy = y1 - my;
          target = (my - y1) * 0.42 * Math.exp(-(dx * dx * 0.25 + dy * dy) / (2 * 120 * 120));
        }
        offsets[i] += (target - offsets[i]) * 0.07;
        const d = `M-40,${y0.toFixed(1)} C${a.toFixed(1)},${(y1 + offsets[i]).toFixed(1)} ${b.toFixed(1)},${(y2 + offsets[i] * 0.45).toFixed(1)} ${cx},${cy}`;
        paths[i].setAttribute('d', d);
        glows[i].setAttribute('d', d);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      inside = true;
    };
    const onLeave = () => {
      inside = false;
    };

    const ro = new ResizeObserver(() => {
      size();
      if (reduce) draw(0);
    });
    ro.observe(stage);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    size();
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      lines.replaceChildren();
      glow.replaceChildren();
    };
  }, []);

  return (
    <div ref={stageRef} className="relative h-[560px]">
      <svg
        ref={svgRef}
        aria-hidden
        className="absolute inset-0 h-full w-full overflow-visible [mask-image:linear-gradient(90deg,transparent,#000_22%)]"
      >
        <defs>
          <linearGradient ref={gradRef} id={GRAD_ID} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--ribbon-1)" />
            <stop offset=".45" stopColor="var(--ribbon-2)" />
            <stop offset=".8" stopColor="var(--ribbon-3)" />
            <stop offset="1" stopColor="var(--ribbon-4)" />
          </linearGradient>
          <filter id={BLUR_ID} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <g ref={glowRef} filter={`url(#${BLUR_ID})`} opacity={0.28} />
        <g ref={linesRef} />
        <circle ref={pingRef} className="signal-ping" r={7} fill="var(--ribbon-4)" />
        <circle ref={nodeRef} r={6} fill="var(--ribbon-4)" />
      </svg>
      <div ref={cardRef} className="absolute right-0 top-1/2 -translate-y-1/2">
        {children}
      </div>
    </div>
  );
}
