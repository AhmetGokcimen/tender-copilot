import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // English first. Ship Romanian by adding 'ro' here + messages/ro.json
  // (same keys as messages/en.json) — no component changes needed.
  locales: ['en'],
  defaultLocale: 'en',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

export type Locale = (typeof routing.locales)[number];
