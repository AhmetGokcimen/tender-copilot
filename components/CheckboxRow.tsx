import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * Single shared checkbox row: fixed 16px box, uniform gap and label styling.
 * Use everywhere a checkbox + label pair appears — never style ad-hoc.
 * `dense` is the compact scrollable-list variant (same box and gap, smaller
 * label, tighter rows with hover feedback).
 */
export function CheckboxRow({
  id,
  label,
  hint,
  meta,
  dense,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'className'> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  meta?: ReactNode;
  dense?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={
        dense
          ? 'flex cursor-pointer items-center gap-space-sm rounded py-1 text-on-surface hover:bg-surface-container-low'
          : 'flex cursor-pointer items-start gap-space-sm text-on-surface'
      }
    >
      <input
        id={id}
        type="checkbox"
        {...inputProps}
        className={
          dense
            ? 'h-4 w-4 shrink-0 cursor-pointer accent-accent'
            : 'mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent'
        }
      />
      <span
        className={
          dense
            ? 'flex-1 truncate font-body-sm text-body-sm leading-snug'
            : 'flex-1 font-body-md text-body-md leading-snug'
        }
      >
        {label}
        {hint ? (
          <span className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">
            {hint}
          </span>
        ) : null}
      </span>
      {meta}
    </label>
  );
}
