import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/** Search and AI crawlers that are welcome on the public pages. */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Amazonbot',
  'Meta-ExternalAgent',
  'DuckAssistBot',
  'MistralAI-User',
  'cohere-ai',
  'CCBot',
];

const PRIVATE = ['/api/', '/en/app', '/ro/app', '/en/auth', '/ro/auth', '/en/onboarding', '/ro/onboarding'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
