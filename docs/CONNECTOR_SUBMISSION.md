# Submitting Licits to Claude's connectors directory

Anthropic's guide: https://claude.com/docs/connectors/building/submission (check it before submitting: the form and the requirements can change). This file is the prepared material and the status of each requirement.

## Requirement status

| Requirement | Status |
|---|---|
| Remote server over HTTPS | Done: `https://licits.com/api/mcp` (Streamable HTTP, stateless JSON). |
| OAuth 2.0 when auth is needed | Done: OAuth 2.1 with PKCE and dynamic client registration. Discovery at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. See `docs/API_AND_MCP.md`. |
| Every tool has a human-readable title | Done: `title` and `annotations.title` on all six tools (`backend/api/mcp_routes.py`, `TITLES`). |
| Safety annotations on every tool | Done: all tools are `readOnlyHint: true`, `destructiveHint: false`. |
| `Origin` header validation | Done: browser origins outside the allow-list get `403`; requests with no `Origin` pass. Extra hosts through `MCP_ALLOWED_ORIGINS`. |
| Public documentation | Done: https://licits.com/docs/mcp (EN) and https://licits.com/ro/docs/mcp (RO). |
| Privacy policy covering the connector | Done: https://licits.com/privacy#connectors. |
| Terms covering the connector | Done: https://licits.com/terms (section "Connecting your own AI assistant or scripts"). |
| Support channel | Contact page https://licits.com/contact. **Needs your decision:** the form may want a support email address; `SITE.email` in `lib/site.ts` is still empty. |
| Test account for reviewers | **Needs you.** See below. |
| Production deployment, tested | Verify after merge: `curl https://licits.com/.well-known/oauth-authorization-server`, then connect once from claude.ai yourself. |

## What you have to do

1. **Connect it yourself first** (claude.ai, Settings, Connectors, Add custom connector, `https://licits.com/api/mcp`). Reviewers will follow the same path, so any rough edge you hit is one they will hit.
2. **Create a reviewer account** on the live site with a finished company profile (CPV codes, keywords, capacity) so `recommend_tenders` returns real results. Give the login to the reviewers in the form's private field only. Do not put it in the repo or in a public page. Accounts are invite only, so send that account an invite first.
3. **Submit the form** under your own name or company, with the text below.
4. Keep the server up and the OAuth flow working while the review runs; connectors with reliability problems can be removed.

## Text to paste

**Name:** Licits

**Server URL:** `https://licits.com/api/mcp`

**Short description:** Find the Romanian public construction tenders your company can win. Ask your assistant for open SEAP notices ranked for your own saved filters, open a tender to see what you meet or lack, and check your deadlines.

**Long description:** Licits reads every SEAP notice for construction works and ranks them for your company's profile: trades, CPV codes, counties, exclusions and capacity. Connect it and ask in plain language: which open tenders fit us, which close soon, what are we missing for this one. Read only: the connector cannot change your account, create keys, send messages or submit anything on SEAP. You sign in with your Licits account and can disconnect at any time in Settings.

**Authentication:** OAuth 2.1 (authorization code with PKCE, dynamic client registration, refresh tokens). One scope: `tenders.read`.

**Documentation:** https://licits.com/docs/mcp

**Privacy policy:** https://licits.com/privacy

**Example prompts**

1. Find me the best open tenders for my company that close in at least two weeks.
2. Which road works in Cluj are open, and which one fits us best?
3. What am I preparing, and what closes this week?

## Tools

| Tool | Title | Read only |
|---|---|---|
| `get_my_filters` | Show my saved filters | yes |
| `recommend_tenders` | Recommend the best tenders | yes |
| `search_tenders` | Search tenders | yes |
| `get_tender` | Open a tender | yes |
| `upcoming_deadlines` | Show upcoming deadlines | yes |
| `my_pipeline` | Show my tender board | yes |

No resources and no prompts are exposed.

## Limits worth stating

Daily calls per user: 100 (Start), 1,000 (Growth), 5,000 (Pro). At most 25 tenders per answer. Tender titles and texts come from third parties; every result carries a notice that they are data, not instructions.
