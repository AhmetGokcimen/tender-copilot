# API Changes (single file — write here from now on)

This used to be two files (`backend/API_CHANGES.md`, `frontend/API_CHANGES.md`).
They are merged here, history preserved below. The versioned contract is
[backend/openapi.json](backend/openapi.json).

---

# Restructure — Vercel monorepo (2026-10-29)

One Vercel project instead of two deploy targets: Next.js at the repo root,
the FastAPI app as a single Python serverless function behind the same
origin. No endpoint or behavior changed — pure restructure.

## What moved

- `frontend/*` → repo root (`app/`, `components/`, `lib/`, `stores/`,
  `package.json`, `next.config.mjs`, ...).
- `backend/` stays a root package, but every internal import is now
  `backend.*`-prefixed (`uvicorn backend.main:app` from the root).
- `api/index.py` (new, the ONLY file under `api/`) re-exports `app` for
  Vercel; `vercel.json` rewrites `/api/*` to it. Backend modules live in
  `backend/` rather than under `api/` on purpose: Vercel turns every `.py`
  file under `api/` into a separate function.
- `requirements.txt`, `pyproject.toml`, `.env`, `.env.example` are now at
  the root; `.python-version` pins 3.14.
- `openapi.json` stays at `backend/openapi.json`; regenerate from the root
  (see README).

## Operational changes

- **Same-origin.** Production API calls are relative (`/api/...`) — no
  CORS involved. `NEXT_PUBLIC_API_URL` is now only an override for
  pointing local dev at a remote API (see `lib/api.ts`).
- **CORS middleware is KEPT** in `backend/main.py` for the local
  two-process dev flow (`next dev` + separate `uvicorn`), where the
  browser still talks cross-origin when the proxy is bypassed. It does
  nothing in production (same-origin requests don’t trigger CORS).
- **Local dev proxy.** `next.config.mjs` rewrites `/api/*` to
  `http://localhost:8000/api/*` in development only, so the default
  relative URLs work unchanged with two local processes.
- **`GET /health`** still exists (root-mounted, no auth) — useful as a
  deploy smoke check.
- **GitHub Actions sync** (`.github/workflows/sync-tenders.yml`) is
  unchanged in behavior: `SYNC_URL` is now the single deployed origin
  (e.g. `https://ofera.vercel.app`, still no `/api` suffix since
  `/internal` mounts at root).
- **SQLite default** (`backend/data/app.db`) is anchored to the backend
  directory, not the cwd, so running from the root keeps using the same
  file. Production still needs `DATABASE_URL` (Supabase — separate step).

---

# API Changes — backend 0.5.0 → 0.6.0 (2026-10-28)

Status-check follow-ups: async scoring (serverless-safe), the
`/companies/{id}` PATCH data-loss fix, enrich pagination. The versioned
contract is [backend/openapi.json](backend/openapi.json) (regenerated from `main.app`,
27 paths — the new GET shares the score path).

## /company vs /companies — verdict: both stay, different jobs

Git history confirms two intentional APIs, not dead code: `/companies`
is the original explicit-ID CRUD + heavy pipelines (score / enrich /
eligibility / company-tenders); `/company` (singular) is the later
wizard self-service API (JWT auto-resolves the company, partial PATCH,
onboarding status/options). Nothing removed.

## BREAKING — POST /companies/{id}/score is async now

It used to score every stored tender inline (15+ min at 3.7k rows —
incompatible with short-lived serverless functions and a frozen UI on
onboarding). Now it mirrors the caiet job pattern:

- `POST /api/companies/{id}/score` → **202** `ScoreJobResponse`
  `{job_id, company_id, status, total, processed, error, ...}`.
  Re-POSTing while a job is active returns that job (**200**), no
  duplicate rescore. Was: 200 with the full state list — frontend
  MUST switch to poll-then-read (below).
- `GET /api/companies/{id}/score` → latest job (404 when never started).
  Poll `processed/total` until `done`, then read scores via
  `GET /api/companies/{id}/tenders` or `GET /api/tenders` as before.
- Same scoring math, same no-clobber upserts (score fields only),
  in batches of 100 with per-batch progress commits; idempotent replays
  after a restart (stale jobs reaped as failed on boot, re-POST to
  resume).
- Considered and rejected: lazy request-time scoring — feed sort/filter
  (`sort=match`, `min_score`) reads persisted scores, so lazy would
  have rewritten every feed path. The job keeps the architecture.

## BREAKING (behavior) — PATCH /companies/{id} is truly partial now

Two live-verified bugs fixed: the response was always `{}` (a commit
expired attrs without the reload `create_company` does), and unset
fields were reset to defaults (PUT-style — real data-loss risk: a
`{"team_size": 50}` call wiped industry/turnover). Now:

- Request body is `CompanyPatch` with `exclude_unset=True` — omitted
  keys are untouched, explicit nulls still clear (same contract as
  `PATCH /company`, including industry preseed + blank-name 422).
- Returns the full updated `CompanyProfile` (was `{}`).
- Migration: anyone relying on the reset side effect must send explicit
  nulls instead. Full-body callers see no difference except a correct
  response.

## Additive — enrich pagination

`POST /api/companies/{id}/enrich` gained `?offset=0` /
`?response_limit=` (None = all, the historical default) slicing the
returned state list — the 1.3 MB unpaged dump stays available but is
no longer mandatory. AI-call `limit` unchanged.

## Frontend wiring (other session)

- **Score**: replace "POST score, use response list" with "POST → 202
  job → poll GET until done → GET tenders". Show `processed/total` as
  progress; on `failed`, show `error` + retry (re-POST).
- **Company edit form**: the plural PATCH is now safe for partial
  saves (same as the wizard's singular PATCH); the response is usable —
  no more refetch-after-save workaround needed.
- **Enrich**: pass `response_limit` (e.g. 50) unless you really need all
  states.

## No new dependencies (0.6.0)

Nothing added to `requirements.txt`.

---

# API Changes — backend 0.4.0 → 0.5.0 (2026-10-28)

Incremental SEAP sync (cron-triggered, serverless-safe) + contract-award
ingestion with parsed winners + incumbent/renewal analytics. The versioned
contract is [backend/openapi.json](backend/openapi.json) (regenerated from `main.app`,
27 paths).

## Deployment target: still open (read first)

The repo has no `vercel.json` / `Dockerfile` / `Procfile` / `.github`,
so the backend's host is UNDETERMINED — nothing below guesses it. The
sync is therefore built "short-lived + externally triggered" (a cron
POST per run, checkpointed, idempotent), which is correct on
Vercel/Render/Railway/Fly alike: no daemon, no in-process scheduler,
nothing that needs a long-lived process. USER ACTION after picking a
host: set the two repo secrets below and confirm the function timeout
covers one sync run (~1-3 min typical, bounded by `max_seconds`).

## New endpoints (0.5.0, all additive — nothing breaking)

| Method & path | Purpose |
|---|---|
| `POST /internal/sync-tenders` | Cron tick: pulls tenders (+ optionally awards) published since the last run. Auth is `X-Sync-Token: <SYNC_SECRET>` (shared secret, NOT a user JWT; JWTs are rejected here). Params: `?lookback_hours=48` (fresh checkpoint only), `?max_tenders=500`, `?include_awards=true`, `?max_awards=100`, `?max_seconds=240`. Returns a `SyncReport` (`tenders_synced`, `awards_synced`, `awards_pdf_errors`, per-feed `capped`/`timed_out` + checkpoints, `duration_seconds`). `capped`/`timed_out` are NORMAL — the next tick continues from the checkpoint (HTTP stays 200). 403 on bad token, 503 when `SYNC_SECRET` is unset. |
| `GET /api/tenders/{external_id}/authority-history` | Incumbent lens: `(contracting_authority, CPV-division)` aggregation — notice count/date-range/value + award count/value + top-5 winners by wins. `insufficient_data: true` + `sample_size: N` until 3+ awards back the table (no "usual winner" off noise). Auth-gated like the rest of `/api/*`; data itself is global (no company scoping). 404 on unknown tender. |

## Changed behavior (0.5.0)

1. **`TenderFeedItem` gained `renewal_pattern`** (additive key, old builds
   ignore it): `{detected, confidence, prior_count, avg_interval_days,
   next_expected_date, note}`. Computed on the DETAIL route only
   (`GET /api/tenders/{id}`) — the feed leaves it `null` to avoid N+1
   sibling queries. `null` also means "fewer than 3 dated points, no
   basis"; `detected: false` means "looked, gaps aren't periodic".
   `next_expected_date` is an explicitly labeled ESTIMATE (see `note`),
   never a promise. Heuristic, not ML: same authority + same CPV
   division + max/min gap ratio ≤ 1.8.
2. **No-clobber extended to sync**: `upsert_tenders`/`upsert_awards` only
   ever write their own tables' columns — `UserTenderState` (scores,
   notes, pipeline status) and the tender's AI columns are untouched by
   re-syncs, and award winner fields are never wiped by a later
   list-only re-fetch (`COALESCE(excluded, current)`).
3. **Fresh database needed** (same drill): new `award` and
   `synccheckpoint` tables. From the repo root: delete `backend/data/app.db`, start
   the API (tables auto-create), then `python -m backend.scripts.backfill_initial`
   (or POST the internal endpoint with a big lookback).
4. **`fetch_tenders` honors explicit windows** (`start=`/`end=` override
   `days=`) and takes `enrich=` — existing callers unchanged.

## Sync design (for the operator)

- **Slices are atomic.** Work is split into 7-day slices, oldest first;
  the checkpoint advances only over fully completed slices (empty weeks
  included). Caps/timeouts are checked BETWEEN slices: a run may
  overshoot `max_*` by one slice rather than silently drop a tail.
- **Idempotent.** Re-running a window re-upserts identical rows (tender +
  award PKs are the conflict targets). Two overlapping runs converge
  instead of corrupting.
- **Bounded politeness.** Same 0.3s inter-request delay as before,
  sequential slices, no new parallelism. Six CPV divisions
  (`45,30,33,50,72,60` — the busiest, measured) keep volumes sane.
- **Awards.** `GetCANoticeList` (type 3, windowed, CPV-prefixed) for the
  list + one print-PDF download per award, parsed deterministically
  (V.2.1 contract, V.2.2 offers, V.2.3 winner+CIF, V.2.4 values — no AI).
  Failed PDFs keep the list-level row with null winner and count into
  `awards_pdf_errors`; parsed winners are never re-downloaded.
  Limitation: multi-lot awards keep the FIRST V.2 block only, and the
  award detail view route is undiscovered (`source_url` stays null).
- **Backfill** (`python -m backend.scripts.backfill_initial`, one-shot, resumable).
  Seed run 2026-10-28 (6 divisions, defaults): 3,755 unique tenders over
  75 days (~7 min incl. Section-I enrich) + 771 awards with 0 PDF errors
  (~28 min of polite sequential PDF downloads). 732/771 awards (95%)
  carry a parsed winner + CIF; the rest are winnerless-by-structure
  (cancelled/unawarded notices parse clean with null winner — not
  errors). Total ~35 min, ~3.2 MB SQLite. Coverage note: awards are two
  samples — 250 rows over 09-28→10-05 plus 521 over 10-21→10-28, with a
  disclosed 10-05→10-21 gap (an interrupted first pass; refilling it
  would cost ~1k extra PDF downloads for demo-marginal value, so it
  stays open); the cron extends forward from 10-28.
- **Cron** (`.github/workflows/sync-tenders.yml`, every 6h at minute 17,
  plus manual dispatch): POSTs the internal endpoint and prints the
  one-line report. Needs TWO repo secrets (Settings → Secrets →
  Actions): `SYNC_URL` = bare backend origin WITHOUT `/api` suffix
  (e.g. `https://api.ofera.app`, since `/internal` mounts at root) and
  `SYNC_TOKEN` = the backend's `SYNC_SECRET` env value (see
  `.env.example`). No secrets in the workflow file itself.

## Frontend wiring (other session)

- **Authority history**: `GET /api/tenders/{id}/authority-history` →
  `{authority, cpv_group, notices{count, first_date, last_date,
  total_estimated_value}, awards{count, total_value, winners[{name,
  wins, total_value}]}, insufficient_data, sample_size}`. When
  `insufficient_data`, show the sample size honestly ("based on N
  awards") instead of a winner claim.
- **Renewal**: detail responses now carry `renewal_pattern` (nullable —
  see §Changed). Render `next_expected_date` WITH the estimate caveat
  (`note`); never present it as a scheduled date.
- **Sync internals** (`/internal/*`, `SyncReport`, checkpoints) are
  operator-facing, not UI-facing — no frontend work needed.

## No new dependencies (0.5.0)

PyMuPDF (already required) parses the award PDFs — nothing added to
`requirements.txt`.

---

# API Changes — backend 0.3.0 → 0.4.0 (2026-10-27)

Country bidding-readiness tracking (the onboarding wizard's step 7 +
eligibility-screen warning box backend). The versioned contract is
[backend/openapi.json](backend/openapi.json) (regenerated from `main.app`).

## What this is (read first)

NOT a visa form and NOT a legal verification system: a self-declared
tracking/reminder mechanism. Each company keeps one row per country —
`not_started` / `in_progress` / `obtained` plus free-text notes — stating
whether it believes it holds that country's bidding prerequisites (e.g.
Romania's ONRC registration). The system never verifies anything; the
status is the user's own word. No document checks, no registry APIs —
deliberately out of scope.

## New endpoints (0.4.0, all additive — nothing breaking)

| Method & path | Purpose |
|---|---|
| `GET /api/company/authorizations` | Caller's rows (`country_code`, `status`, `requirement_notes`, `updated_at`), ordered by code. Optional `?company_id=` (membership-checked, 403 for strangers). 404 with no company. |
| `PATCH /api/company/authorizations/{country_code}` | Upsert one row: `{status?, requirement_notes?}`, only provided keys change. Works for target and non-target countries (proactive rows allowed). 422 on bad status / malformed code. |
| `GET /api/countries/{country_code}/requirements` | Static reference: `{country_code, name, guide_available, guidance}`. Romania carries a real informational write-up (with a not-legal-advice disclaimer); Poland/Bulgaria/others return honest placeholders. 422 on malformed codes. |

## Changed behavior (0.4.0)

1. **Feed `state` gained `country_authorization_status`** (`"not_started" |
   "in_progress" | "obtained" | null`, null = no row opened). It sits next
   to `eligible` but is a strictly separate dimension — criterion fit vs
   country readiness are never merged into one boolean. Additive key: old
   frontend builds ignore it.
2. **The feed never filters on it by default.** `GET /api/tenders` returns
   every tender regardless of authorization; an unauthorized country only
   shows up as data. Opt-in filter `?authorization_status=` exists for callers
   that explicitly want it.
3. **Target countries auto-seed rows.** Setting `target_countries` via any
   company write path (`POST`/`PATCH /company`, `POST`/`PATCH
   /companies[/{id}]`) creates `not_started` rows for newly picked countries.
   Additive only: existing statuses are never reset, and removing a country
   from targets does not delete its row.
4. **`core/eligibility.py` untouched.** The True/False/None verdict still
   answers only "do you meet this tender's criteria".
5. **Fresh database needed** (same drill as before): new
   `countryauthorization` table. Run `python -m backend.scripts.migrate_demo` from
   the repo root, re-sync, re-onboard.

## Frontend wiring (other session)

- **Wizard step 7**: replace the "coming soon" placeholder with a country
  list from the company's `target_countries` (plus an "add another country"
  affordance): each row shows `GET /countries/{code}/requirements`
  guidance, a 3-state status control + notes field bound to `PATCH
  /company/authorizations/{code}`. The step stays skippable and never
  blocks `onboarding-status.complete` (required fields unchanged).
- **Eligibility screen**: render a separate warning box next to (not merged
  with) the eligible/maybe/not verdict, driven by
  `state.country_authorization_status`: `obtained`/null show nothing (null
  = user hasn't tracked this country yet — not an accusation),
  `not_started`/`in_progress` show "bidding readiness for {country}:
  {status}" with a link to the wizard step. Never hide or disable the
  tender over it.
- **Feed**: no filtering changes needed; the optional
  `?authorization_status=` param exists if a future filter UI wants it.

## No new dependencies (0.4.0)

Pure SQLModel/Pydantic — nothing added to `requirements.txt`.

---

# API Changes — backend 0.2.0 → 0.3.0 (2026-10-27)

Multi-tenant companies + onboarding wizard backend. The versioned contract
is [backend/openapi.json](backend/openapi.json) (regenerated from `main.app`).

## Breaking changes (0.3.0)

1. **No more singleton company.** `GET /company` now returns the *caller's*
   company (404 until they onboard) instead of the globally-first one, and
   returns the full `CompanyDetail` shape (a superset of the old
   `CompanyResponse` — extra keys are ignored by TS, so existing components
   keep working). Same scoping for `GET /company/evidence`.
2. **Company routes are membership-checked.** `GET /companies` lists only
   the caller's companies; `GET/PATCH /companies/{id}` and every
   `/companies/{id}/*` route (score, enrich, eligibility, tenders, status
   PATCH) return **403** for a company the caller doesn't belong to (404
   when the id doesn't exist at all). Feed `?company_id=` behaves the same.
3. **`/auth/me` grew a field**: `{…, "company_ids": [...]}` (additive).
   Empty array = show the onboarding wizard.
4. **New DB tables/columns need a fresh database** (same drill as 0.2.0):
   new `app_user` + `user_company` tables; `CompanyProfile` gained
   `industry`, `founded_year`, `team_size`, `target_countries`, `keywords`.
   Run `python -m backend.scripts.migrate_demo` from the repo root (timestamped backup
   first, then delete), re-sync, and onboard the demo company again.
5. **Eligibility/score input is request-scoped, not global.**
   `core/eligibility.py` needed no signature change (it already takes the
   profile as an argument) — the change is that routes now pass the
   membership-verified company from the JWT identity. Same numbers, honest
   ownership.

## New endpoints (0.3.0)

| Method & path | Purpose |
|---|---|
| `POST /api/company` → **201** | Wizard step 1: create with just `{"name"}` (rest via PATCH). Auto-links caller as owner; industry pre-seeds CPVs when none given. 422 on blank name / bad enum values. |
| `PATCH /api/company` | Wizard steps 2..N: partial update, only provided keys applied (`exclude_unset`), so steps never clobber each other. Optional `?company_id=` for multi-company users (403 for strangers). 404 with no company. |
| `GET /api/company/onboarding-status` | `{company_id, complete, required, optional, missing_required, missing_optional}`. No company → `company_id: null`, everything missing. Poll after each step. |
| `GET /api/company/options` | Dropdown contents: `industries[]` (`key/label/suggested_cpv_codes`), `keywords[]` (`key/label/related_cpv_codes`), `countries[]` (`code/name/source_systems`, currently RO only). Never hardcode these client-side. |

Unchanged: feed/detail/status-PATCH shapes, `/extract`, async `/extract-caiet`
jobs (tender-global, no company involved), sync, enrich/score/eligibility
request/response shapes (now just membership-checked).

## Field notes for the wizard (other session)

- Minimum viable profile = `name` + `industry` + `annual_turnover`
  (`onboarding-status.complete` flips when these are filled). Everything
  else is optional and can be completed later.
- `annual_turnover` vs `similar_experience_value` stay **separate fields**
  (yearly revenue vs cumulative past-contracts value — the eligibility
  engine compares each against its own threshold; don't merge them in the
  UI into one "turnover" input).
- `industry`, `keywords`, `target_countries` are validated server-side
  against `/company/options` (422 otherwise) — render them as selects from
  that endpoint, not free text.
- `certifications` stays a plain string list on the profile (the Archive &
  Certificates screen keeps reading `GET /company/evidence`, which derives
  from it). No separate certificate table exists yet.
- `target_countries` uses ISO codes matching `Tender.country_code`
  (`["RO"]` for now; the adapter registry grows here).
- Demo login still works one-click, but the demo identity is now a real
  `User` row: onboard it once via the wizard and its company persists.
  Separate Google accounts get fully isolated companies/states.
- Migration: `python -m backend.scripts.migrate_demo` (backup-first reset; prints
  next steps). Table `app_user` is explicitly named (PostgreSQL reserves
  `user`) to keep the SQLite-now-Postgres-later story.

## No new dependencies (0.3.0)

Multi-tenancy, onboarding, and validation are pure SQLModel/Pydantic —
nothing was added to `requirements.txt`.

---

# API Changes — backend 0.1.0 → 0.2.0 (2026-10-27)

Handoff notes for the frontend session. The versioned contract itself is
[backend/openapi.json](backend/openapi.json) (regenerated from `main.app` — 20 paths).

## Breaking changes

1. **Auth is now required.** Every `/api/*` call except `/api/auth/*` needs
   `Authorization: Bearer <JWT>`, else 401. Mint a token in one click via
   `GET /api/auth/demo` (fixed demo user, 30-day token) or
   `GET /api/auth/google/login` (real Google account). The old `API_KEY` /
   `X-API-Key` mechanism is **removed** (env var gone from `.env.example`).
2. **`GET /api/tenders` shape changed.** It returned a paged
   `{items, total, limit, offset}` of flat tenders; it now returns a **bare
   array** of nested `TenderFeedItem`, matching `lib/types.ts`
   `TenderWithState` one to one (see "New feed contract"). The old
   `country_code` query param is gone; new filter params below replace it.
3. **CORS default tightened.** Was `*`; default is now exactly
   `http://localhost:3000`. Add the deployed Vercel origin to
   `ALLOWED_ORIGINS` (comma-separated) — no wildcard.
4. **New DB columns need a fresh database.** `Tender` gained `county`,
   `procedure_type`, `clarification_deadline`; `CompanyProfile` gained `cui`;
   new `OcrJob` table. SQLite `create_all` does not migrate existing files:
   **delete `backend/data/app.db`** (or point `DATABASE_URL` at a fresh file) and
   re-sync. Re-syncing backfills the new columns via upsert.
5. **`/extract` (Section III) is unchanged** — same path, same response.
   Caiet extraction is a separate async flow (below), not a change to it.

## New endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/auth/google/login` | 302 to Google (real OAuth2 code flow). 501 if `GOOGLE_CLIENT_ID` unset — use demo login. |
| `GET /api/auth/google/callback` | Google redirects here; backend mints a JWT and 302s to `{FRONTEND_URL}/auth/callback?token=…`. |
| `GET /api/auth/demo` | One-click login: 302s to `{FRONTEND_URL}/auth/callback?token=…` with the demo token. No Google account needed. |
| `GET /api/auth/me` | Current user `{sub, email, name, provider}` (authed). |
| `GET /api/tenders` | Bare `TenderFeedItem[]`. Optional: `company_id` (default: first company), `county`, `cpv_code`, `min_value`, `min_score`, `procedure_type`, `eligible`, `search` (title substring), `sort=match\|deadline\|value` (default `match`, nulls last), `limit` (50, ≤200), `offset`. |
| `GET /api/tenders/{external_id}` | One nested item for the Analysis screen (+ optional `company_id`). Romania-only for now. 404 when missing. |
| `PATCH /api/tenders/{external_id}/status` | Kanban write path: `{status, note?}` (+ optional `company_id`). Same rules as the company-scoped PATCH (status/note only; 404 if never scored). Returns the updated nested item. |
| `GET /api/company` | Single company profile incl. `cui`. 404 until created via `POST /companies`. |
| `GET /api/company/evidence` | `EvidenceItem[]` derived from the profile's certifications (see below). |
| `POST /api/tenders/romania/{id}/extract-caiet` | Starts async caiet extraction → **202** `{job_id, status: pending, …}`. Re-POST while active returns the same job (**200**, no double AI spend). 404/422 like `/extract`. |
| `GET /api/tenders/romania/{id}/extract-caiet` | Latest job: `pending→running→done` (`result` holds `caiet_name`, `extracted_requirements`, `extraction_confidence`, `ocr_pages`, `scanned_pages`, `truncated`) or `failed` (`error`). 404 if never started. On `done` the Tender row is also updated, so feed/detail show it. |

Untouched and still working: `POST /tenders/sync/romania`, `POST /companies`,
`GET /companies`, `GET /companies/{id}`, `PATCH /companies/{id}`,
`GET /companies/{id}/tenders` (flat shape kept), `PATCH
/companies/{id}/tenders/romania/{ext}`, `POST /companies/{id}/score`,
`POST /companies/{id}/enrich`, `POST /tenders/romania/{id}/extract`,
`POST /companies/{id}/tenders/romania/{id}/eligibility`.

## Field derivations & defaults (why the feed never breaks the TS types)

- `authority` = SEAP `contractingAuthorityNameAndFN`, else `""`.
- `county` = buyer-address NUTS-3 code suffix (`"RO421 Arad"` → `"Arad"`,
  via Section I at sync time), else `""`. The dedicated SEAP `county`
  field is null in practice — NUTS is the source.
- `procedure_type` mapped from SEAP vocab at sync time: `Licitatie
  deschisa`→`open`, `Licitatie restransa`→`restricted`, `Procedura
  simplificata`→`open` (below-threshold open competition, no shortlist),
  `*negociere*`→`negotiated`, `*directa*`→`direct`,
  `Acord-cadru`→`framework`. **Unmapped/missing → `open`** (documented
  default; consider adding `'unknown'` to the `ProcedureType` union).
- `clarification_deadline` = `submission_deadline − noDays` (Section I
  clarification window), else `null`.
- `raw_description`: SEAP list/detail views expose no tender description
  text — always `null` for now (nullable in the types, so contract-safe).
- `state.extracted_requirements: string[]` = flattened summary lines from
  the structured extraction dict (turnover → experience → certifications →
  guarantee → other, verbatim). `[]` when never extracted.
- `state.missing_documents` = required certifications the company does not
  hold (case-insensitive). `[]` without a company context.
- `state.ai_title_simplified` is copied from the Tender row into `state`
  (storage stays tender-intrinsic per the no-clobber split).
- `company.cui` = stored CUI, else `""` (until set via create/update).
- `evidence[]` = one `{id: cert-N, name, type: "Certification",
  valid_until: null}` per profile certification. A real vault with expiry
  tracking is future work.

## Frontend TODOs (other session)

1. Attach `Authorization: Bearer <token>` to every `/api/*` call.
2. Implement the `/auth/callback?token=…` page (store token, e.g.
   localStorage) — both login flows land there.
3. Handle `GET /api/company` 404 (no company yet → onboarding/create flow).
4. Poll `GET …/extract-caiet` after POST (2–5 s interval; `done`/`failed`
   are terminal). Job rows survive polling but not server restarts —
   orphaned `running` jobs are marked `failed` on boot with a retry hint.
5. Set the prod `ALLOWED_ORIGINS` (Vercel URL) on the backend deployment.
6. Optional: add `'unknown'` to `ProcedureType` so the backend can stop
   defaulting unmapped procedures to `'open'`.

## OAuth / CORS notes

- Google Cloud console must register exactly
  `{BACKEND_URL}/api/auth/google/callback` (default
  `http://localhost:8000/api/auth/google/callback`); localhost works for
  dev without verification.
- OAuth/demo redirects are top-level navigations, not XHR — CORS does not
  apply to them and cannot conflict. CORS only gates `/api/*` fetch calls
  from the allow-listed frontend origins.
- `GOOGLE_CLIENT_SECRET` lives in `.env` only — never committed
  (`.env.example` holds placeholders). Without it, Google login 501s and
  demo login still works.

## New dependency

- `pyjwt>=2.8` — HS256 session tokens (Google + demo) and self-contained
  OAuth `state` (integrity + expiry without a server session store).
  Deliberately **no** `google-auth`/`authlib`: the code flow needs only
  three plain HTTPS calls (authorize redirect, code exchange, userinfo),
  done with the already-present `httpx`.

## Known limitations (conscious hackathon scope)

- Single-company demo: `company_id` is optional everywhere and defaults to
  the first company. No per-user data isolation — all logins share the
  demo dataset (documented, not a bug for now).
- No signup/password/reset/email-verify/multi-tenant management — by design.
- Extract-caiet jobs run in-process (`BackgroundTasks`); a restart fails
  in-flight jobs (see TODO 4). A real queue (arq/Celery) is the follow-up.
- `extract_requirements` schema and `/extract` logic untouched, as required.

---

# Frontend notes — onboarding + auth session

Consumed contract: **backend v0.3.0** (`API_CHANGES.md` 0.3.0 section below,
`backend/openapi.json`, 22 paths). No backend files were touched.

## What was built

- Auth: `/auth/login` (Google + demo buttons), `/auth/callback?token=`
  (captures the backend-issued JWT, routes to `/app` or `/onboarding`),
  JWT in localStorage attached to every real-mode API call, demo entry on
  the landing navbar. Mock mode bypasses all of it (existing behavior kept).
- Wizard at `/onboarding` (7 steps: name, industry + founding year, annual
  turnover, track record, team, markets + keywords, permits placeholder).
  Each step saves via `POST`/`PATCH /company`; progress survives reloads;
  dashboard unlocks once `onboarding-status.complete` is true.
- Gate: `/app` renders only for signed-in users with a complete-enough
  profile, otherwise redirects to login/onboarding. No dashboard flash.
- `CompanyProfile` type now mirrors backend `CompanyDetail` 1:1; new
  endpoints follow the mock/real flag principle (`MOCK_OPTIONS` mirrors
  backend lookups for offline mode — real mode always fetches).

## Open questions / backend needs

1. **Visa field (waiting on the user, not the backend).** The brief assumed
   a "vize bilgisi" field exists on `CompanyProfile` — it does **not**:
   `openapi.json` v0.3.0 `CompanyDetail`/`CompanyPatch` have no visa-like
   field (verified by schema dump + case-insensitive grep). The wizard
   shows step 7 as a clearly-marked "coming soon" placeholder that saves
   nothing and never blocks. Open question for the user: does "vize"
   mean (a) tender permits/licenses the company holds, or (b) staff work
   visas / foreign personnel? Once decided, backend adds the field (name +
   shape TBD) and this step gets wired like the others.
2. **Suggestion (non-blocking): currency options.** The wizard hardcodes a
   RON/EUR/USD currency select because the backend neither validates nor
   serves currencies. If the backend ever adds `currencies[]` to
   `GET /company/options`, the wizard should switch to it; until then the
   hardcoded three are fine.
3. **No other backend gaps found.** Industry/keyword/country selects,
   validation (422 details surface inline), and the status endpoint all
   behaved as documented.

## Session: country authorizations UI (backend v0.4.0)

Consumed: `GET /company/authorizations`, `PATCH
/company/authorizations/{code}`, `GET /countries/{code}/requirements`, and
`state.country_authorization_status` on feed/detail responses. Built:

- Wizard step 7 is now a real form (was "coming soon"): rows for the union
  of picked targets + opened rows, status select + notes + lazy "More
  info" guidance per country. Skippable, never blocks completion.
- Tender detail shows a neutral, standalone readiness notice below the
  eligibility verdict (silent for `obtained`/null). Feed cards show a
  subtle `RO · In progress` style meta hint, never a verdict-colored chip.
- Company Settings gained a "Country authorizations" management section
  (edit status/notes per row, save changed only).
- Mock parity: `useAuthorizationStore` (+ persisted), feed/detail mock
  responses derive the status from it exactly like the backend does.

Backend needs: none. The proactive "add another country" affordance was
deliberately left out of scope — no backend change required for it later
(`PATCH .../authorizations/{code}` already upserts any code); it is purely
a future UI addition (country picker + row).
