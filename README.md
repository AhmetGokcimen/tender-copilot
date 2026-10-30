# Licits (Tender Copilot)

AI copilot that monitors public procurement systems and helps SMEs find and
respond to tenders they're actually eligible for. Built for the Meta Global
AI Developer Hackathon (submission deadline: 2026-11-04, 21:00 ET).

One repo, one deploy: the Next.js frontend lives at the repo root and the
FastAPI backend ships as a single Python serverless function behind the
same origin (`/api/*`) on Vercel. No CORS in production.

## Repo layout

```
tender-copilot/
├── app/            Next.js App Router (locale-prefixed pages)
├── components/     React components (+ landing/)
├── lib/            frontend: types (backend mirror), api client, hooks, mock data
├── stores/         zustand stores (filters, pipeline, company, generator, ...)
├── messages/       next-intl UI strings (en.json, ...)
├── i18n/           next-intl routing config
├── middleware.ts   locale routing (its matcher never touches /api)
├── backend/        FastAPI app: adapters, DB, AI layer (import as backend.*)
├── api/
│   └── index.py    Vercel entrypoint: re-exports backend.main:app (only file here)
├── vercel.json     /api/* → Python function rewrite + bundle excludes
├── requirements.txt  Python runtime deps (Vercel installs these; dev tools in requirements-dev.txt)
├── ruff.toml         ruff config
├── .python-version   pins the Vercel Python runtime (3.12)
├── package.json      Next.js deps
├── API_CHANGES.md    the single changelog (backend + frontend history merged)
└── backend/openapi.json  versioned API contract snapshot
```

The frontend talks to the backend only through relative `/api/*` calls —
same origin in production; local `next dev` proxies `/api` to the uvicorn
backend (see `next.config.mjs`). Nothing in `backend/` assumes anything
about how the frontend is built.

## Architecture: multi-country from day one

Only Romania's SEAP/SICAP (`e-licitatie.ro`) is implemented for the
hackathon, but nothing in the core logic is Romania-specific:

- Every `Tender` row carries `country_code` and `source_system`
  ([backend/models/tender.py](backend/models/tender.py)).
- Each country/source is a separate **adapter** implementing
  `TenderSourceAdapter` ([backend/adapters/base.py](backend/adapters/base.py)).
  Source-specific auth and request format are isolated inside the
  adapter — the first implementation is
  [backend/adapters/romania_seap/adapter.py](backend/adapters/romania_seap/adapter.py).
- Pre-filter/scoring, the AI layer, and eligibility matching operate only on
  the normalized `Tender`/`CompanyProfile` models, so they stay
  country-agnostic. CPV codes are EU-wide standard and used as the universal
  categorization key.
- Adding a new country = writing one new adapter module. Nothing in
  `backend/core/`, `backend/models/`, or `backend/api/` needs to change.

```
backend/
  adapters/          # one module per country/source
    base.py          # TenderSourceAdapter interface
    romania_seap/     # first implementation (e-licitatie.ro)
  core/              # config + country-agnostic pre-filter/scoring
  models/            # SQLModel tables: Tender, CompanyProfile, UserTenderState
  ai/                # Meta AI model client (summarization, extraction)
  db.py              # engine/session + the upsert that keeps AI fields safe
  api/               # REST endpoints consumed by the frontend
```

## Storage

SQLite to start (zero setup, file-based — no separate service to stand up
during a 9-day hackathon), via SQLModel so moving to Postgres later is just
changing `DATABASE_URL`. The default points at `backend/data/app.db`,
anchored to the backend directory (not the cwd), so running from the repo
root keeps using the same file.

`Tender` (raw, adapter-written) and `UserTenderState` (AI output: score,
summary, eligibility verdict, per company) are **separate tables on
purpose**. The previous JSON-file system had a real bug where re-seeing a
tender wiped its AI fields, because the whole record got overwritten on
every re-fetch. Here, `backend.db.upsert_tenders` does a SQL
`INSERT ... ON CONFLICT (source_system, external_id) DO UPDATE` that only
ever touches `Tender`'s own columns — it cannot reach `UserTenderState`,
so that bug class is now structurally impossible, not just avoided by
convention.

## Scoring

`backend/core/scoring.py` ranks a tender against a `CompanyProfile` (CPV match tier
-> value/capacity ratio bands -> deadline penalty -> AI-worth-it threshold),
carried over from a validated single-company prototype's logic, rewritten
from scratch against the normalized models. It never drops a tender —
a 0 score with a reason is the signal, same principle as the AI layer:
justify, don't silently decide.

## AI layer

`backend/ai/client.py` talks to `api.meta.ai`'s Responses API — confirmed live
2026-10-26, and *not* the OpenAI-compatible chat/completions shape other
Meta/Llama endpoints use: `POST {base_url}/responses` with `{model,
instructions, input: [...], text: {format: {...}}}`; the reply text is
nested in `output[].content[].text` on the item where `type == "message"`
(there's also a `"reasoning"` item in there to skip past). Override via
`META_API_BASE_URL`/`META_MODEL` if a different gateway is ever needed.
Three jobs, each told to justify rather than decide and to flag what it's
unsure of rather than invent it:

- `summarize_justification` — 2-3 sentence fit explanation for one tender
  + one company profile.
- `simplify_title` — rewrites a tender title in plain language, preserving
  project codes and place names (never translated/dropped).
- `extract_requirements` — pulls turnover/experience/certification/
  guarantee requirements out of specification text into a typed schema
  (`ExtractedRequirements`). JSON-schema-constrained, retried up to 3
  times on invalid JSON; if it still fails, returns
  `extraction_confidence="failed"` with the raw output attached instead of
  raising — nothing crashes because the model misbehaved once.

Now wired to real text: `RomaniaSeapAdapter.fetch_eligibility_text` calls
SEAP's `GetSection3View` detail endpoint (confirmed live, see below) and
concatenates the exclusion/registration, economic/financial, and
technical/professional criteria fields — SEAP's equivalent of an EU
notice's Section III, and the closest thing to real specification text
the list endpoint doesn't carry. `POST /api/tenders/romania/{id}/extract`
fetches it and runs it through `extract_requirements`.

`extracted_requirements` and `ai_title_simplified` live on `Tender` itself,
not `UserTenderState` — they don't depend on which company is looking, so
keeping them per-company would mean redoing the same AI call for every
company that scores the tender. `backend.db.upsert_tenders`'s `ON CONFLICT DO
UPDATE` explicitly excludes both columns, so a re-fetch still can't wipe
them — same no-clobber guarantee as the Tender/UserTenderState split,
just applied within this one table too. Verified: synced → extracted →
re-synced → extraction still there.

## Eligibility-comparison engine

`backend/core/eligibility.py` + `backend.ai.client.compare_eligibility` turn one tender's
`extracted_requirements` into a concrete verdict against a `CompanyProfile`
(`UserTenderState.eligible`: `True`/`False`/`None`). Split in two on
purpose:

- Turnover and similar-experience-value comparisons are plain arithmetic
  in `backend/core/eligibility.py`, not left to the model — removes an easy
  source of LLM arithmetic error.
- The AI layer takes those results as given facts and only reasons about
  what genuinely needs judgment: matching free-text certification
  requirements, and writing the justification. Told explicitly not to
  default to `eligible=None` just to avoid committing, but also never to
  invent a company capability it wasn't given.

Caught and fixed one real bug this way: the extraction model was
returning the source text's own currency word ("lei") instead of an ISO
code, which silently broke the deterministic value comparison (treated
as a currency mismatch instead of a match). Fixed by requiring ISO 4217
codes in `EXTRACT_SYSTEM_PROMPT` and re-verified.

`POST /api/companies/{id}/tenders/romania/{id}/eligibility` runs it for
one tender/company pair (requires `/extract` to have run first).

## Status

Done: storage layer, Romania SEAP adapter (verified live), the detail/
eligibility-text fetch, scoring, the AI layer, and the eligibility-
comparison engine, plus REST endpoints tying them all together.

The SEAP adapter's endpoints, headers, and response field names are
confirmed working, tested live against `e-licitatie.ro` (not guessed) —
e.g. `fetch_tenders(cpv_codes=["45310000"], days=30)` returned 119 real,
currently-open tenders with correct titles/values/deadlines/links, and
`fetch_eligibility_text` pulled ~19KB of real Section III criteria text
for one of them (including a real "4,000,000 RON cumulative similar
experience" style requirement).

**Tested against the real Meta AI API** (2026-10-26, `muse-wonder-1.0`),
on 5 real synced tenders + 3 real SEAP Section III extractions:
- Title simplification: correctly preserved every project/reference code
  (`ATR 7010240912508`, `M-24-B278/M-23-B060`) and place name, translated
  only the descriptive parts.
- Justifications: grounded in the actual tender's CPV/value/deadline,
  consistently flagged unstated things (experience threshold, turnover,
  certifications) as "unclear, verify yourself" instead of guessing —
  never made a go/no-go call itself.
- Extraction: every number it returned was checked against the raw
  Section III text and matched exactly (e.g. "cumulated value ≥
  1,049,852.57 lei" — verified present verbatim in source). Correctly
  told apart a cumulative-experience-value figure from an annual-turnover
  figure (a real place a simpler extractor could conflate the two) in two
  separate tenders, and correctly flagged a tender with two different
  experience lookback windows (5y works / 3y services) as worth a second
  look instead of silently picking one. No fabricated requirements found
  in this sample.
- Eligibility verdicts (3 real tenders, 2 company profiles — one strong,
  one weak): produced `True`, `False`, and `None` verdicts correctly,
  including a `None` for a tender with a real second sub-requirement
  (a photovoltaic-specific lot) the given company data genuinely couldn't
  confirm either way — not a lazy default, a correct "can't tell."

## API

Full schema: [backend/openapi.json](backend/openapi.json) (static snapshot —
regenerate with the command below after changing any route) or the live,
always-current `GET /openapi.json` / interactive `GET /docs` once the
server is running. Change history: [API_CHANGES.md](API_CHANGES.md).

```
GET   /api/tenders                        list stored tenders, paginated
      ?country_code=&cpv_code=&limit=&offset=
POST  /api/tenders/sync/romania           fetch from SEAP, upsert into storage
      ?cpv_codes=45310000&days=30
POST  /api/tenders/romania/{id}/extract   fetch real SEAP eligibility text,
                                           run it through AI extraction

POST  /api/companies                      create a company profile
GET   /api/companies                      list company profiles
GET   /api/companies/{id}                 get one company profile
PATCH /api/companies/{id}                 update a company profile (full object)

GET   /api/companies/{id}/tenders         the frontend's main feed: every
      ?status=&eligible=&min_score=       tender scored for this company,
      &limit=&offset=                     with score/AI/eligibility + user
                                           status/note flattened in, paginated
PATCH /api/companies/{id}/tenders/romania/{id}
                                           set status (new/reviewing/applied/
                                           rejected/ignored) and/or a note —
                                           the only writer of those two fields

POST  /api/companies/{id}/score           score all stored tenders for a company
POST  /api/companies/{id}/enrich          AI-justify the highest-scoring,
      ?limit=20&language=en               not-yet-enriched tenders for a company
POST  /api/companies/{id}/tenders/romania/{id}/eligibility
                                           compare extracted requirements
                                           against the company profile
```

Typical frontend flow for one company: create company -> sync tenders ->
score -> poll `GET /{id}/tenders` for the feed -> `/enrich` and, per
tender, `/extract` + `/eligibility` to fill in the AI columns -> user
edits status/note via the `PATCH .../tenders/romania/{id}` call.

## Auth and CORS

JWT auth: every `/api/*` call except `/api/auth/*` needs an
`Authorization: Bearer <JWT>` header — mint one via `GET /api/auth/demo`
(one click) or the Google OAuth flow (`/api/auth/google/login`). Data is
multi-tenant: every login owns its companies via onboarding. See
[API_CHANGES.md](API_CHANGES.md) for the auth history.

CORS: production is same-origin (frontend + API on one Vercel deployment),
so browsers never trigger CORS there. The `CORSMiddleware` in
`backend/main.py` is KEPT for the local two-process dev flow
(`next dev` on :3000 + `uvicorn` on :8000), where cross-origin calls still
happen when the dev proxy is bypassed. `ALLOWED_ORIGINS` defaults to
`http://localhost:3000`.

## Setup (local dev)

Prerequisites: Python 3.14 (see `.python-version`), Node 20+.

```bash
# from the repo root
python -m venv backend/.venv
backend/.venv/Scripts/activate   # Windows (elsewhere: source backend/.venv/bin/activate)
pip install -r requirements-dev.txt
cp .env.example .env     # fill in META_API_KEY etc.
npm install

# terminal 1 — API on :8000
uvicorn backend.main:app --reload

# terminal 2 — web on :3000 (/api proxied to :8000 in dev)
npm run dev
```

Open `http://localhost:3000` in a browser (redirects to `/en`). Mock mode
is the default (`NEXT_PUBLIC_USE_MOCK=true`); set
`NEXT_PUBLIC_USE_MOCK=false` in `.env` to hit the real API (same-origin
`/api`, no extra config needed).

Interactive API docs: `http://localhost:8000/docs`. Regenerate the static
contract snapshot after changing a route:

```bash
python -c "import json, backend.main as m; json.dump(m.app.openapi(), open('backend/openapi.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)"
```

Operator scripts (from the root): `python -m backend.scripts.migrate_demo`
(backup-first demo reset), `python -m backend.scripts.backfill_initial`
(one-shot history backfill).

Alternative: `vercel dev` (Vercel CLI) serves the Next.js app and the
Python function together the way production does. The two-process flow
above is the verified default; `vercel dev` is documented but was not
re-verified after this restructure.

## Frontend

Next.js (App Router) + TypeScript + Tailwind. English UI, Romanian-ready via
`next-intl` (add `messages/ro.json` + `'ro'` in `i18n/routing.ts` — no
component changes needed).

Mock vs real API: default is mock mode (`NEXT_PUBLIC_USE_MOCK=true`): all
data comes from `lib/mock-data.ts`, shaped exactly like the backend JSON
(`lib/types.ts` mirrors `backend/models/*`). Set
`NEXT_PUBLIC_USE_MOCK=false` to call the real backend — same-origin, no URL
config needed. Only `lib/api.ts` (and `lib/assistant-api.ts`) branch on
the flag.

- `app/[locale]/page.tsx` — public landing page (`/`); sections in `components/landing/`
- `app/[locale]/app/` — dashboard: `/app` opportunities, `/app/tenders/[id]` analysis,
  `/app/pipeline` kanban, `/app/generator` DUAE drafts, `/app/archive`, `/app/settings`
- `components/` — Sidebar, TenderCard, KanbanBoard, TenderDetail, chips, KPI cards
- `lib/` — types (backend mirror), api client, react-query hooks, mock data,
  draft templates, formatting
- `stores/` — zustand: filters, pipeline (persisted), company (persisted), generator (persisted)
- `messages/en.json` — all UI strings; `i18n/` — next-intl routing config

## Deploy (Vercel)

Single Vercel project from this repo: Next.js is auto-detected at the root,
`api/index.py` becomes the Python function, `vercel.json` routes `/api/*`
to it. No build-command / output-directory overrides needed.

Environment variables to set in the Vercel project (see `.env.example`):
required: `META_API_KEY`, `JWT_SECRET` (long random — the default is
dev-only), `SYNC_SECRET` (must equal the `SYNC_TOKEN` repo secret for the
Actions sync workflow), `FRONTEND_URL` + `BACKEND_URL` (both = the deployed
origin, e.g. `https://ofera.vercel.app`), `NEXT_PUBLIC_USE_MOCK=false`.
Optional: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Google login; without
them only demo login works), `META_API_BASE_URL`/`META_MODEL` (gateway
override), `ALLOWED_ORIGINS` (same-origin production never triggers CORS;
harmless to set to the deployed origin).

Still open / next steps (not part of this restructure):

- `DATABASE_URL` is SQLite by default, which doesn't work on Vercel
  (read-only filesystem, no persistence across invocations). The Supabase
  (Postgres) migration is the planned follow-up — until then, a production
  deploy needs `DATABASE_URL` pointed at Postgres.
- Function timeout: long endpoints (sync, score/enrich jobs) can exceed
  serverless limits — the sync workflow's `max_seconds` should fit the
  plan's `maxDuration` (no `maxDuration` is set in `vercel.json` because
  the cap is plan-dependent).
- Lifespan/shutdown: only 500ms on Vercel; the async job patterns
  (extract-caiet, score) already persist progress per batch and resume via
  re-POST, which is the serverless-safe shape — see API_CHANGES.md.
- Cron: Vercel crons run on production only; the GitHub Actions
  `sync-tenders.yml` workflow stays as the sync trigger (no `crons` in
  `vercel.json`).

## Research note: website-to-API tooling

SEAP already exposes a usable JSON API, so this isn't needed yet. Kept here
for when we add a country whose procurement portal requires scraping.
Findings as of 2026-10-26:

| Tool | Stars | Last push | Notes |
|---|---|---|---|
| [ishandutta2007/Awesome-Website-To-API](https://github.com/ishandutta2007/Awesome-Website-To-API) | 8 | 2026-07 | Curated list, not a tool itself. Points to Scrapy, Colly, Apify as the actual implementations. |
| [Aditya8840/browse2api](https://github.com/Aditya8840/browse2api) | 7 | 2026-03 | Small TypeScript project, low activity/adoption — risky to depend on for a hackathon. |
| [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | ~196k | daily | Turns any site/URL into clean structured markdown/JSON via an API; handles JS-rendering and some anti-bot out of the box. Hosted or self-host. Best default if a future country needs scraping. |
| [apify/crawlee](https://github.com/apify/crawlee) | ~26k | daily | Node/TS crawling framework (Playwright/Cheerio/HTTP), proxy rotation, headless mode — more control than Firecrawl but more setup. |
| [ScrapeGraphAI/Scrapegraph-ai](https://github.com/ScrapeGraphAI/Scrapegraph-ai) | ~32k | active | LLM-driven scraping pipelines (describe what you want extracted instead of writing selectors) — good fit if a portal's HTML is messy/inconsistent. |

**Recommendation:** skip the two repos you linked (too small, unmaintained
relative to alternatives) and reach for **Firecrawl** first if/when a future
country adapter needs real scraping — it's actively maintained, has a
hosted API (fast to integrate under hackathon time pressure), and already
handles JS rendering + basic anti-bot. Fall back to **Crawlee** only if a
site needs custom interaction (logins, pagination clicks) Firecrawl can't
handle. Keep the scraping call behind that country's adapter class either
way — core logic never needs to know whether a source was a clean JSON API
or a scraper.
