export function formatRON(value: number | null, compact = false): string {
  if (value === null || value === undefined) return '—';
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `RON ${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `RON ${Math.round(value / 1_000)}K`;
    return `RON ${value}`;
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Whole days from today (local midnight) until the ISO date; null when unknown. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export function formatDaysLeft(iso: string | null): string {
  const days = daysUntil(iso);
  if (days === null) return '—';
  if (days < 0) return 'Closed';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/** Match-score tone per DESIGN.md intervals: 90+ emerald, 70–89 cyan, else amber/red. */
export function scoreTone(score: number | null): 'high' | 'mid' | 'low' | 'poor' {
  if (score === null) return 'poor';
  if (score >= 90) return 'high';
  if (score >= 70) return 'mid';
  if (score >= 50) return 'low';
  return 'poor';
}

/** English UI: the plain English title when one exists; Romanian UI: the notice's own title. */
export function tenderTitle(t: { title: string; state: { ai_title_simplified: string | null } }, locale: string): string {
  return locale === 'en' ? (t.state.ai_title_simplified ?? t.title) : t.title;
}
