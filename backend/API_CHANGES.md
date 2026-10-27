# API Changes — backend 0.1.0 → 0.2.0 (2026-10-27)

Handoff notes for the frontend session. The versioned contract itself is
[openapi.json](./openapi.json) (regenerated from `main.app` — 20 paths).

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
   **delete `data/app.db`** (or point `DATABASE_URL` at a fresh file) and
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
