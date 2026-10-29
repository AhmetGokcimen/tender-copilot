/** Shared Lichit form field classes (labels above inputs, indigo focus ring). */
const FIELD =
  'w-full rounded-field border border-line-strong bg-raised px-3 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-indigo focus:shadow-[0_0_0_3px_var(--indigo-soft)]';

export const INPUT = `h-11 ${FIELD}`;
export const INPUT_COMPACT = `h-9 ${FIELD} text-[14px]`;
export const LABEL = 'flex flex-col gap-1.5 text-[13px] font-medium text-ink-2';
