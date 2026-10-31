# SEO, answer-engine and generative-engine optimization

What Licits does so that search engines and AI assistants find it, understand it and quote it correctly. Positioning: software for Romanian construction companies, aimed at firms new to public tenders and at firms moving on from tender consultants.

## What is in place

| Layer | Where | Why |
|---|---|---|
| Per-page title, description, canonical, hreflang (`en`, `ro`, `x-default`), Open Graph, Twitter | `lib/seo.ts`, `generateMetadata` in each page | One canonical URL per language, and the two languages point at each other. |
| Social preview image | `app/[locale]/opengraph-image.tsx` | Brand card per language. |
| Structured data (JSON-LD) | `lib/schema.ts`, `components/seo/JsonLd.tsx` | Organization, WebSite and SoftwareApplication on the home page; FAQPage on the home page and on every guide; Article (with `citation`, `abstract`, translation link), BreadcrumbList and CollectionPage on resources; AboutPage, ContactPage and WebPage elsewhere. |
| Crawl rules | `app/robots.ts` | Public pages open to search and to named AI crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended and others). `/api`, `/app`, `/auth`, `/onboarding` are closed. |
| No-index for the product | `next.config.mjs` (`X-Robots-Tag`) | Signed-in screens never appear in results. |
| Sitemap with language alternates | `app/sitemap.ts` | Every public page and guide, both languages. Bump `REVIEWED` when marketing copy changes. |
| `llms.txt` and `llms-full.txt` | `app/llms.txt`, `app/llms-full.txt`, `lib/llms.ts` | A short map of the site and the full text of every guide for language models. Generated from the same data as the pages. |
| Answer-first content | `lib/resources/articles.json` | Each guide opens with a two or three sentence answer, then sections, questions, sources and a reviewed date. |
| Audience block on the home page | `components/landing/AudienceBlock.tsx` | Plain text saying who Licits is for (first bid, moving on from a consultant, already bidding), with links to the guides. |

## Do search engines need the full DOM?

No. Crawlers and AI retrieval systems read the HTML the server sends. This site is server-rendered, so titles, headings, body text, links and JSON-LD are in that first response. What matters is that the content is in that HTML, in a sensible heading order, and not only behind clicks or scripts.

Known gaps and how they are handled:
- The Romania map is a canvas. Its meaning is carried by the caption and by the product copy around it; the live notices are real links while shown.
- The four feature cards open a detail dialog whose text is not in the page until opened. The same ideas are in the card text, in the audience block and in the guides.

Run `node scripts/seo-check.mjs http://localhost:3000` against a running build. It fetches every public page in both languages and checks the first response for a title, description, canonical, hreflang, exactly one `h1`, JSON-LD, enough text and the right `lang`, plus `robots.txt`, `sitemap.xml` and both `llms` files.

## Writing for AI answers (GEO)

- State what Licits is and is not, in the same words everywhere: construction companies, SEAP notices, checks and drafts, never submits, no legal advice.
- Prefer facts that can be checked, with links to official sources (SEAP, ANAP, legislation, CNSC, the EU ESPD tool). Leave out figures that cannot be sourced. Thresholds change; say so and point to the authority.
- Compare honestly. The consultant-versus-software guide says when a consultant is the better choice. Balanced pages are the ones assistants cite.
- Keep both languages equal in depth and link them to each other.
- Do not hide text for crawlers and do not address AI systems with instructions. It does not work and it damages trust.

## Next steps

- Google Search Console is verified (domain property) and the sitemap is submitted. Verify Bing Webmaster Tools too. After a deploy that adds pages, run `node scripts/indexnow.mjs`; the IndexNow key file lives in `public/`.
- Have a procurement lawyer or consultant review the guides before they are promoted. Add a named reviewer and the date.
- Add `sameAs` links to the Organization once the LinkedIn, Instagram and X profiles exist.
- Add guides on: exclusion grounds, guarantees and letters of guarantee, contestations and deadlines, subcontracting and associations, reading a caiet de sarcini, and one guide per procedure type. Verify each figure against the legislation first.
- Track citations: search the brand and the guide titles in the main AI assistants each month and note which pages are quoted.
