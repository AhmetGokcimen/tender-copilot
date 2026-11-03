# API keys, REST API and MCP server

Users can let their own AI assistant (Claude, ChatGPT, Cursor, ...) or a script read their tenders. The data is the same as in the web app and is ranked for the user's saved profile (CPV codes, keywords, exclusions, capacity, certifications), so "find me something good" means good *for this company*.

Everything exposed here is **read-only**. A leaked key can read tenders; it cannot change an account, create keys or send anything.

## For users

Settings → **AI assistant & API**: create a key, copy it (it is shown once), paste the config for your client. Up to 5 active keys, optional expiry, revoke any time.

Example prompts once connected:

- "Find me the best open tenders for my company that close in at least two weeks."
- "What am I preparing, and what closes this week?"
- "Open tender 123456 and tell me what we are missing to bid."

## Authentication

| | Used for | Credential |
|---|---|---|
| `/api/api-keys` | creating, listing, revoking keys (web app only) | the normal session JWT |
| `/api/v1/*` | read-only REST | `Authorization: Bearer ofk_…` |
| `/api/mcp` | MCP server | `Authorization: Bearer ofk_…` **or** an OAuth access token `ofo_…` |
| `/api/oauth/*`, `/.well-known/*` | letting claude.ai / ChatGPT sign the user in | none (public endpoints, see below) |

A key cannot create keys, and a session JWT is not accepted on `/api/v1` or `/api/mcp`. Keys are `ofk_` + 43 random URL-safe characters; only their SHA-256 is stored. Unknown, revoked and expired keys all return the same `401`.

## Limits

- **Daily quota per user** (all keys together, UTC day): start 100, growth 1000, pro 5000 calls (`backend/core/plans.py`, `API_DAILY_CALLS`). Beyond it: `429` with `Retry-After` until 00:00 UTC. Every request counts, including MCP `initialize`/`tools/list`.
- **Burst**: 60 calls per minute per key, kept in memory per serverless instance (best effort).
- **Page size**: at most 25 tenders per call.
- At most 5 active keys per user.

## REST: `/api/v1`

| Endpoint | What it returns |
|---|---|
| `GET /me` | owner, company, key name, today's usage |
| `GET /profile` | the saved filters that rank tenders |
| `GET /tenders` | search, best match first |
| `GET /tenders/{id}` | one tender in detail (description, requirements, what is met or missing) |
| `GET /deadlines` | tenders closing soon (`within_days`, `followed_only`) |
| `GET /pipeline` | the user's board by status |

`GET /tenders` filters: `q` (words in title, summary, authority), `county`, `cpv` (code or prefix: `45`, `45233`), `procedure_type`, `min_value`, `max_value`, `min_score`, `eligible`, `deadline_within_days`, `min_days_left`, `include_closed`, `include_dismissed`, `sort` (`match`, `deadline`, `value`), `limit`, `offset`.

```bash
curl -H "Authorization: Bearer $LICITS_KEY" \
  "https://licits.com/api/v1/tenders?cpv=45&min_days_left=14&min_score=60&limit=5"
```

Interactive, always-current reference: `/docs` (FastAPI). The static `backend/openapi.json` snapshot is regenerated separately and has not been refreshed for these endpoints.

## MCP: `/api/mcp`

Streamable HTTP, stateless: the client POSTs JSON-RPC and gets JSON back. No sessions, no streaming, so it runs as a serverless function. `GET`/`DELETE` return `405`. It speaks protocol versions 2025-06-18, 2025-03-26 and 2024-11-05, and is implemented directly (about 250 lines) rather than with the MCP SDK to keep the Vercel bundle small.

Tools (all `readOnlyHint`):

| Tool | Purpose |
|---|---|
| `get_my_filters` | the user's saved matching profile |
| `recommend_tenders` | best open tenders now (`min_score` 50, `min_days_left` 5, `limit` 5) |
| `search_tenders` | the REST search filters |
| `get_tender` | full detail for one tender id |
| `upcoming_deadlines` | what closes soon (default: tenders being prepared or applied to) |
| `my_pipeline` | the board by status |

Tool failures (bad arguments, unknown id) come back as a normal result with `isError: true`, as the MCP spec asks, so the model can correct itself.

### Client config

Claude Code:

```bash
claude mcp add --transport http licits https://licits.com/api/mcp --header "Authorization: Bearer ofk_…"
```

Cursor (`.cursor/mcp.json`):

```json
{ "mcpServers": { "licits": { "url": "https://licits.com/api/mcp", "headers": { "Authorization": "Bearer ofk_…" } } } }
```

Claude Desktop (through `mcp-remote`):

```json
{
  "mcpServers": {
    "licits": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://licits.com/api/mcp", "--header", "Authorization:${LICITS_AUTH}"],
      "env": { "LICITS_AUTH": "Bearer ofk_…" }
    }
  }
}
```

## Connecting claude.ai and ChatGPT (OAuth)

These connectors cannot send a custom header, so the MCP server is also an OAuth 2.1 authorization server. The user adds the address `https://<site>/api/mcp` as a custom connector, signs in to Licits, clicks **Allow**, and is connected. No key to copy.

What happens:

1. The client calls `/api/mcp` without credentials and gets `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`.
2. It reads `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` (RFC 9728 / 8414).
3. It registers itself at `POST /api/oauth/register` (dynamic client registration, public client, no secret).
4. It sends the user's browser to `/en/auth/authorize` (the consent page). If signed out, the user logs in first and returns to the consent page. The page calls `POST /api/oauth/authorize` with the user's session and receives the redirect back to the app, carrying a one-time code.
5. The client swaps the code (plus its PKCE verifier) at `POST /api/oauth/token` for an access token (1 hour) and a refresh token (30 days, rotating).

Rules enforced (`backend/core/oauth.py`):

- PKCE `S256` is mandatory; codes live 5 minutes and work once. A reused code disconnects the app.
- Redirect addresses are exact-match against what the app registered (loopback addresses match on any port). `javascript:`, `data:`, plain `http://` to non-loopback hosts and fragments are refused at registration. An unregistered address gets a plain `400`, never a redirect.
- Refresh tokens rotate; presenting an old one disconnects the app.
- One read-only scope, `tenders.read`, the same reach as an API key. Registration is limited to 10 per client IP per hour.
- Each approved app appears in Settings as a **Connected app** (it does not use up one of the 5 key slots). **Disconnect** kills its tokens at once. Calls count against the same daily quota.

Routing: `vercel.json` sends `/.well-known/*` to the Python function, like `/api/*`. The consent page is `app/[locale]/auth/authorize/page.tsx`; the URLs in the discovery documents are built from the request host (or `X-Forwarded-Host`), so previews and production each advertise their own address.

## Connector directory

Listing in Claude's connectors directory is prepared in [CONNECTOR_SUBMISSION.md](CONNECTOR_SUBMISSION.md): requirement status, what only the owner can do, and paste-ready form text.

## Security notes

- **Prompt injection.** Tender titles, descriptions and authority names are third-party text that an assistant will read. Every MCP result carries a `notice` saying so, the server `instructions` repeat it, and no tool can write anything, so an injected instruction has nothing to act on.
- **Scraping.** The daily quota, the page size cap and the burst limit bound how fast the dataset can be pulled through a key. Tune `API_DAILY_CALLS` per plan when billing lands.
- **Isolation.** Per-company scores, statuses and the board are only returned for companies the key's owner belongs to. A key can be pinned to one company (`company_id`), otherwise it uses the owner's first.
- **No keys in URLs.** Keys are accepted only in the `Authorization` header.

## Code map

| | |
|---|---|
| `backend/models/api_key.py` | `ApiKey`, `ApiKeyUsage` (tables are created by `init_db`) |
| `backend/core/api_keys.py` | create / revoke, key authentication, burst and daily limits |
| `backend/core/tender_api.py` | the read operations shared by REST and MCP |
| `backend/api/key_routes.py` | `/api/api-keys` (session JWT) |
| `backend/api/v1_routes.py` | `/api/v1` |
| `backend/api/mcp_routes.py` | `/api/mcp` |
| `backend/core/oauth.py`, `backend/api/oauth_routes.py`, `backend/models/oauth.py` | OAuth server for claude.ai / ChatGPT |
| `app/[locale]/auth/authorize/page.tsx` | consent page |
| `components/ApiAccessSection.tsx` | Settings screen |
| `backend/tests/test_api_access.py` | tests for all of the above |
