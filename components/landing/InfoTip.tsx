import type { ReactNode } from 'react';

/**
 * A small "?" that explains a line in the plan list. The tip opens under the line, across the
 * width of the list item (which must be `relative`). Pure CSS, so it needs no
 * client code: it opens on hover, on keyboard focus, and on tap (a tap focuses
 * the button on phones). The text is also announced to screen readers.
 */
export function InfoTip({ id, label, children, dark = false }: { id: string; label: string; children: ReactNode; dark?: boolean }) {
  return (
    <span className="group/tip ml-1.5 inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className={`flex h-[17px] w-[17px] items-center justify-center rounded-full border text-[10.5px] font-semibold leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo ${
          dark ? 'border-on-night/40 text-on-night/70 hover:border-on-night hover:text-on-night' : 'border-muted/60 text-muted hover:border-ink hover:text-ink'
        }`}
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute inset-x-0 top-full z-20 mt-1.5 hidden rounded-[10px] border border-line bg-raised px-3 py-2 text-left text-[12.5px] font-normal leading-[18px] text-ink shadow-lift-2 group-hover/tip:block group-focus-within/tip:block"
      >
        {children}
      </span>
    </span>
  );
}
