/**
 * DOM context collector: builds a compact, serializable summary of the
 * visible interactive elements on the page (buttons, links, form fields,
 * cards, headings) to send to the AI as context. Elements carrying
 * `data-assistant` hooks are the stable addressing contract — the AI should
 * prefer `highlight_selector`s built from those hooks.
 *
 * The assistant's own UI (`data-assistant-ui`) is always excluded so the
 * model can never target or narrate itself.
 */

export interface DomContextNode {
  tag: string;
  text: string;
  role: string;
  /** Stable hook when the element carries `data-assistant`. */
  hook: string | null;
  rect: { x: number; y: number; w: number; h: number };
}

const CANDIDATES =
  'a[href], button, input, select, textarea, h1, h2, h3, [role="tab"], [role="dialog"], [data-assistant]';

function roleOf(el: Element): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'range') return 'slider';
    if (type === 'submit') return 'button';
    return 'textbox';
  }
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') return 'heading';
  return 'generic';
}

function textOf(el: Element): string {
  const labelled =
    el.getAttribute('aria-label') ??
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      ? el.value || el.placeholder
      : null) ??
    (el instanceof HTMLSelectElement ? el.options[el.selectedIndex]?.text : null) ??
    (el.textContent ?? '');
  return labelled.replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function collectDomContext(limit = 80): DomContextNode[] {
  if (typeof document === 'undefined') return [];
  const nodes: DomContextNode[] = [];
  const els = document.querySelectorAll(CANDIDATES);
  for (const el of els) {
    if (nodes.length >= limit) break;
    if (el.closest('[data-assistant-ui]')) continue;
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    nodes.push({
      tag: el.tagName.toLowerCase(),
      text: textOf(el),
      role: roleOf(el),
      hook: el.getAttribute('data-assistant'),
      rect: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
    });
  }
  return nodes;
}
