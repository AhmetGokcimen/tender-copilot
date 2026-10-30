import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { RESOURCES } from '@/lib/resources';
import { PUBLIC_PATHS, pageUrl } from '@/lib/seo';

/** Date the marketing pages were last reviewed. Bump it when their copy changes. */
const REVIEWED = '2026-10-30';

const entry = (path: string, lastModified: string, priority: number): MetadataRoute.Sitemap =>
  routing.locales.map((locale) => ({
    url: pageUrl(locale, path),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, pageUrl(l, path)])),
    },
  }));

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_PATHS.flatMap((p) => entry(p, REVIEWED, p === '' ? 1 : p === '/resources' ? 0.9 : 0.6)),
    ...RESOURCES.flatMap((a) => entry(`/resources/${a.slug}`, a.updated, 0.8)),
  ];
}
