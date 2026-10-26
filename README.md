# Tender Copilot

AI copilot that monitors public procurement systems and helps SMEs find and
respond to tenders they're actually eligible for. Built for the Meta Global
AI Developer Hackathon (submission deadline: 2026-11-04, 21:00 ET).

## Who owns what

```
tender-copilot/
├── backend/    ← this is the backend's: FastAPI, adapters, DB, AI layer
├── frontend/   ← owned by the frontend agent (Muse Code); not touched from here
└── README.md
```

The backend talks to the frontend only through the REST API under `/api`.
Nothing in `backend/` assumes anything about how the frontend is built.

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
  `core/`, `models/`, or `api/` needs to change.

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
changing `DATABASE_URL`.

`Tender` (raw, adapter-written) and `UserTenderState` (AI output: score,
summary, eligibility verdict, per company) are **separate tables on
purpose**. The previous JSON-file system had a real bug where re-seeing a
tender wiped its AI fields, because the whole record got overwritten on
every re-fetch. Here, `db.upsert_tenders` does a SQL
`INSERT ... ON CONFLICT (source_system, external_id) DO UPDATE` that only
ever touches `Tender`'s own columns — it cannot reach `UserTenderState`,
so that bug class is now structurally impossible, not just avoided by
convention.

## Scoring

`core/scoring.py` ranks a tender against a `CompanyProfile` (CPV match tier
-> value/capacity ratio bands -> deadline penalty -> AI-worth-it threshold),
carried over from a validated single-company prototype's logic, rewritten
from scratch against the normalized models. It never drops a tender —
a 0 score with a reason is the signal, same principle as the AI layer:
justify, don't silently decide.

## AI layer

`ai/client.py` talks to Meta's official Llama API in its OpenAI-compatible
mode (`https://api.llama.com/compat/v1`, override via `META_API_BASE_URL`/
`META_MODEL` if the hackathon provides a different gateway). Three jobs,
each told to justify rather than decide and to flag what it's unsure of
rather than invent it:

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

Not yet wired to real specification text: the SEAP list endpoint doesn't
return the full caiet de sarcini, only summary fields — that needs a
detail-endpoint fetch, which isn't implemented. `extract_requirements` is
ready and tested (mocked), just has no real input source yet.

## Status

Done: storage layer, Romania SEAP adapter (verified against the live API),
scoring, the AI layer (verified against a mocked API), and REST endpoints
tying them together. Not started: the eligibility-comparison engine, and
the SEAP detail-endpoint fetch `extract_requirements` needs.

The SEAP adapter's endpoint, headers, and response field names are
confirmed working, tested live against `e-licitatie.ro` (not guessed) —
e.g. `fetch_tenders(cpv_codes=["45310000"], days=30)` returned 119 real,
currently-open tenders with correct titles/values/deadlines/links.

## API

```
GET  /api/tenders                        list stored tenders
POST /api/tenders/sync/romania           fetch from SEAP, upsert into storage
     ?cpv_codes=45310000&days=30
POST /api/companies                      create a company profile
GET  /api/companies                      list company profiles
POST /api/companies/{id}/score           score all stored tenders for a company
POST /api/companies/{id}/enrich          AI-justify the highest-scoring,
     ?limit=20&language=en               not-yet-enriched tenders for a company
```

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env     # fill in META_API_KEY etc.
uvicorn main:app --reload
```

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
