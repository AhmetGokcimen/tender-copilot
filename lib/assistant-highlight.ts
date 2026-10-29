/**
 * Highlight interpreter — the ONLY DOM access the assistant is allowed.
 *
 * Security boundary: the model returns a plain selector string, never code.
 * It is validated against a strict allowlist, resolved with querySelectorAll
 * (first *visible*, non-assistant match wins), and then handled exclusively
 * by these fixed primitives: smooth scroll, a temporary outline ring, and a
 * positioned callout. There is intentionally no eval, no innerHTML, and no
 * way to express anything beyond "highlight this element".
 */

export interface TooltipPlacement {
  x: number;
  y: number;
  placement: 'above' | 'below';
}

const SAFE_SELECTOR = /^[a-zA-Z0-9\s\-_#.\[\]="':,>+~]+$/;
const FORBIDDEN = /(script|javascript|expression|url\(|import|on\w+=)/i;

export function isSafeSelector(selector: string): boolean {
  return (
    typeof selector === 'string' &&
    selector.length > 0 &&
    selector.length <= 200 &&
    SAFE_SELECTOR.test(selector) &&
    !FORBIDDEN.test(selector)
  );
}

export function resolveVisibleTarget(selector: string): Element | null {
  if (typeof document === 'undefined' || !isSafeSelector(selector)) return null;
  let els: NodeListOf<Element>;
  try {
    els = document.querySelectorAll(selector);
  } catch {
    return null;
  }
  for (const el of els) {
    if (el.closest('[data-assistant-ui]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function scrollAndHighlight(el: Element): void {
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  el.classList.add('assistant-highlight');
  window.setTimeout(() => el.classList.remove('assistant-highlight'), 2600);
}

/** Viewport-safe callout anchor near the element: above when room, else below. */
export function tooltipPlacement(el: Element): TooltipPlacement {
  const r = el.getBoundingClientRect();
  const w = 280;
  const gap = 12;
  const x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  const aboveH = 170;
  const placement: 'above' | 'below' =
    r.top > aboveH + gap + 60 ? 'above' : 'below';
  const y =
    placement === 'above'
      ? Math.max(12, r.top - gap - aboveH)
      : Math.min(window.innerHeight - 80, r.bottom + gap);
  return { x: Math.round(x), y: Math.round(y), placement };
}
