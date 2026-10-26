# Tender Copilot

AI copilot that monitors public procurement systems and helps SMEs find and
respond to tenders they're actually eligible for. Built for the Meta Global
AI Developer Hackathon (submission deadline: 2026-11-04, 21:00 ET).

This repo is the **backend only**. The frontend is being built separately
and consumes the REST API under `/api`.

## Architecture: multi-country from day one

Only Romania's SEAP/SICAP (`e-licitatie.ro`) is implemented for the
hackathon, but nothing in the core logic is Romania-specific:

- Every `Tender` record carries `country_code` and `source_system`
  ([app/core/models.py](app/core/models.py)).
- Each country/source is a separate **adapter** implementing
  `TenderSourceAdapter` ([app/adapters/base.py](app/adapters/base.py)).
  Source-specific auth and request format are isolated inside the
  adapter — the first implementation is
  [app/adapters/romania_seap/adapter.py](app/adapters/romania_seap/adapter.py).
- Pre-filter/scoring, the AI layer, and eligibility matching operate only on
  the normalized `Tender`/`CompanyProfile` models, so they stay
  country-agnostic. CPV codes are EU-wide standard and used as the universal
  categorization key.
- Adding a new country = writing one new adapter module. Nothing in
  `core/` or `api/` needs to change.

```
app/
  adapters/          # one module per country/source
    base.py          # TenderSourceAdapter interface
    romania_seap/     # first implementation (e-licitatie.ro)
  core/              # country-agnostic domain models + pre-filter/scoring
  ai/                # Meta AI model client (summarization, extraction)
  storage/           # persistence layer
  api/               # REST endpoints consumed by the frontend
```

## Status

Scaffold only — interfaces and models are defined, logic is not yet
implemented. See open items below; big architecture calls (storage choice,
multi-country schema details, API design) get confirmed before each is
built.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env     # fill in META_API_KEY etc.
uvicorn app.main:app --reload
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
