import { Icon } from './Icon';

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest px-space-lg py-space-xl text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={icon} size="md" />
      </span>
      <p className="font-headline-sm text-headline-sm text-on-surface">{title}</p>
      {hint && <p className="max-w-md font-body-md text-body-md text-on-surface-variant">{hint}</p>}
      {action && <div className="mt-space-xs">{action}</div>}
    </div>
  );
}
