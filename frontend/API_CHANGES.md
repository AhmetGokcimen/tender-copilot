# Frontend notes — onboarding + auth session

Consumed contract: **backend v0.3.0** (`backend/API_CHANGES.md` 0.3.0 section,
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
