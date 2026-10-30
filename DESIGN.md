# DESIGN.md: Licits

Licits helps Romanian construction companies win public works tenders. It reads every SEAP notice for construction works, shows which ones a company can actually win, and drafts the offer with them. This file is the brand book for the landing page and the app. Use it to brief people and AI design tools so new screens stay on brand.

The name is the plural of *licit*, from *licitație* (tender): Licits means "tenders", so the product is clear at a glance.

**Where it lives in code**
- Tokens: CSS variables in `app/globals.css` (`:root`), mapped to Tailwind names in `tailwind.config.ts`.
- Logo: `components/brand/Logo.tsx` (`Logo`, `Wordmark`, `LogoMark`). Favicon: `app/icon.svg`.
- Font: loaded in `app/[locale]/layout.tsx` with `next/font`.
- The token name `indigo` is historical. It now holds the forest green. Keep using `indigo*` classes; do not add new hard-coded greens.

## Logo

**The logo is the wordmark.** *Licits*, capital L, in Schibsted Grotesk 600, tracking -0.035em, `ink` on light and `on-night` on dark. No frame, no tile, no icon next to it.

**The symbol** is for places where the name does not fit: the app sidebar, the favicon, email headers, avatars. It is a lowercase *li* built from two rounded bars and a dot:
- a tall bar (the *l*), and a short bar (the *i*), both `ink` (or `on-night` on dark), fully rounded ends;
- the dot of the *i* in `brand-dot` gold (`#d4a72c`), the only colour in the mark.

Geometry on a 48 × 48 grid: `l` 6 × 34 at (13, 7); `i` 6 × 21 at (25, 20); dot r 3.7 at (28, 11). The symbol has no frame or background shape. Minimum size 16px; keep clear space of one bar width all round.

Do not: recolour the bars, put the gold on the bars, add a gradient, outline it, put it in a box, or set the wordmark in another typeface.

## Colours: Forest + Gold

Warm paper, forest green as the one action colour, gold as a rare accent.

| Token | Value | Usage |
|---|---|---|
| `paper` | `#f6f5f0` | Page background. Warm off-white. |
| `surface` (`raised`) | `#ffffff` | Cards, inputs, popovers, the waitlist card. |
| `surface-sunk` (`sunk`) | `#eeede6` | Wells, tracks, table headers, inactive tabs. |
| `surface-sunk-2` | `#e5e3da` | Deeper wells, pressed sunk controls. |
| `ink` | `#0f1f1a` | Headlines and body text. Never pure black. |
| `ink-2` | `#2b3a34` | Secondary text. |
| `muted` | `#5c6a64` | Captions, helper text, the second half of a two-tone headline. |
| `line` | `#e3e1d7` | 1px hairlines on cards and dividers. |
| `line-strong` | `#8e988f` | Input and control borders (3:1 on surface). |
| `indigo` (forest) | `#0f5c45` | THE action colour: primary button fill, focus ring, active nav, selected state. One filled CTA per section. |
| `indigo-deep` | `#0a4433` | Primary button hover and pressed. |
| `indigo-text` | `#0d5a43` | Links and green text on paper or surface. |
| `indigo-soft` | `#e5efe8` | Selected rows, soft tags, chips, the offer pill. |
| `on-indigo` | `#ffffff` | Text on forest. |
| `brand-dot` | `#d4a72c` | The dot in the symbol. Nowhere else. |
| `ribbon-1` | `#0f5c45` | Brand scale stop 1: forest. |
| `ribbon-2` | `#4f9a76` | Brand scale stop 2: sage. |
| `ribbon-3` | `#c9952a` | Brand scale stop 3: ochre. |
| `ribbon-4` | `#e2b23c` | Brand scale stop 4: gold. |
| `night` | `#0c1f19` | The one dark band (closing waitlist), dark panels. |
| `on-night` | `#eef3ef` | Text on night. |
| `eligible` / `eligible-bg` | `#1d7a3e` / `#e6f3e9` | Eligible, valid, done. Status only. |
| `warn` / `warn-bg` | `#a14306` / `#fff3e0` | Partial match, expiring soon, deadline close. |
| `risk` / `risk-bg` | `#c4320a` / `#fdecea` | Not eligible, expired, form errors. |

**Rules**
- Forest is the only action colour. Gold never fills a button and never sets body text.
- The brand scale (forest → sage → ochre → gold) is used for data art only: the Romania map dots, the agent reading beam, soft background light. Never on text, buttons or borders.
- `eligible`, `warn`, `risk` are states. They never decorate, and never carry meaning by colour alone (always an icon or a word too).
- Dark theme: the marketing site is light only. `[data-theme='dark']` in `globals.css` still carries the previous palette and must be redone in forest and gold before it is offered.

## Typography

**Schibsted Grotesk** (`--font-sans`, latin + latin-ext for ă â î ș ț) for everything readable. **Geist Mono** (`--font-mono`) for data only. Tabular figures (`.tnum`) on every number.

| Style | Size / line | Weight | Tracking | Usage |
|---|---|---|---|---|
| Hero | 58 / 62 (40 / 1.08 mobile) | 300 | -2.1px (-1.4px) | Hero headline only. Second half in `muted`. |
| Display | 44 / 50 | 300 | -1.3px | Section headlines. |
| Title | 26 / 32 | 300–400 | -0.7px | Card, step and dialog titles. |
| Lead | 19 / 29 (17 / 27) | 400 | 0 | Hero subtext, section intros. Max 65ch. |
| Body | 15 / 23 | 400 | 0 | Default UI and copy. |
| Label | 13–14 / 18–21 | 500 | 0 | Form labels, nav, buttons, chips. |
| Caption | 12 / 16 | 400 | 0 | Helper text, footnotes, "Example" labels. |
| Data | 13 / 18 mono | 500 | 0 | Tender IDs, CPV codes, CUI, RON values, dates, counters. |

Light (300) weights at display sizes with negative tracking; regular and medium below 20px. The wordmark is the only place that uses 600 at large size.

## Shape, spacing, elevation

- **Radius:** `field` 8px for inputs and inner chips, `card` 16px for cards and panels, `pill` for every button, tag and toggle. Small floating notices use 10px.
- **Spacing:** 4px base: 4, 8, 12, 16, 24, 32, 48, 96. Sections 96px desktop, 64px mobile. Container 1200px, 16px mobile gutter, 32px desktop.
- **Elevation:** hairline borders first. `lift-1` (`0 1px 3px rgba(16,24,64,.08)`) for resting cards; `lift-2` (`0 12px 32px rgba(16,24,64,.10), 0 2px 6px rgba(16,24,64,.05)`) for floating cards, popovers and the waitlist card. Floating cards over the map use `raised/95` with a light backdrop blur.
- **Grid texture:** a faint square grid sits under content. Landing hero: 28px cells in `line` at 28% opacity, faded at the edges, with a forest copy revealed in a 130px circle around the pointer. App screens (`BlueprintGrid`): 28px cells in `ink` at 3.5% opacity, fixed, no motion. It should be felt, not seen.
- **Icons:** Material Symbols Outlined, one family, 20px in UI, `ink` or `muted`. Icons never carry meaning by colour alone.

## Landing page

Sections, top to bottom: Navbar, Hero, ProductShowcase, ProductBento, FAQ, ClosingCta (the one `night` band), Footer.

**Construction only.** Every headline, example and notice speaks about works: roads, schools, bridges, insulation, sewers. The eyebrow and hero subtext say so explicitly.

**Hero.** Split layout: headline, subtext and a link on the left; the waitlist card on the right (offer pill "2 weeks free", three perks with green checks, one email field, one CTA). Pricing is not shown in the hero during the waitlist phase.
- Headline: *Win the public construction tenders* / *you've been missing.* (second line `muted`).
- Subtext: *Licits reads every SEAP notice for construction works, from roads to school renovations, shows which ones you can win, and drafts the offer with you.*
- One CTA label on the page: **Join the waitlist**.

**The Romania map** is the signature image.
- A dotted map of Romania drawn on canvas from real Natural Earth borders (111 × 78 grid, 9px step). Dots vary in size (1.2–2.7px) and opacity, coloured west to east along the brand scale, forest → sage → gold.
- About one dot in three twinkles gently, each at its own pace.
- It is pinned (sticky) exactly behind the hero, faint, with no notices on it while the hero is in view.
- Below the hero is an intentionally empty scroll band (120dvh). Scrolling through it fades the hero out and brings the map into focus: it brightens to full strength.
- Only once the map is in focus (≥ 0.8) do example construction notices pop up at real city positions, a few at a time (4 wide, 2 narrow, one every 1.6s): a forest pin with a white ring, and a small card with the city, the works and the value in RON. A caption labels them as examples.

## App

- **Shell:** collapsible left sidebar with the *li* symbol at the top, `paper` background with the blueprint grid, `surface` cards.
- **Language:** a text-only `EN | RO` toggle at the top right, no flags. The signup screen has no language switcher; onboarding has its own switcher.
- **Tender Opportunities:** the list takes the full width. Filters live in a popover behind one Filter button at the top, not in a side column.
- **KPI card:** light, on `surface` with hairline border, numbers in mono with tabular figures. No black blocks.
- **No internal labels on screen:** no version strings, no "demo" or codename badges.
- **Status:** chips use `eligible`, `warn`, `risk` with their `-bg` washes, always with an icon or a word.

## Onboarding

Seven steps, one question group per screen, with a step progress indicator on top:
1. Company: CUI (autofilled from ANAF), name, main and secondary CAEN, website.
2. Trades and works, with CPV codes and a blacklist. Works found on the website come preselected.
3. Reach: roles, trades subcontracted out, counties, largest single contract, concurrent projects.
4. Turnover for three years, with the BNR EUR/RON conversion shown.
5. Authorizations (separate from ISO), each with class, number, issue and expiry dates. Uploading a document fills them in.
6. SEAP readiness (account, e-signature with expiry, DUAE) and team counts (EU / non-EU).
7. Review, with a profile strength score.

Expiry dates are always shown with a state: valid (`eligible`), expiring (`warn`), expired (`risk`).

## Agent loading (AgentStage)

What the user sees while an agent works (reading the website, looking up ANAF, scanning a document). It must mean something, not just spin:
- A page drawn in the site's dot language is swept by a reading beam. The lines the agent "keeps" light up in the brand colours.
- Stages tick off while the request runs (for a document: upload, read, extract).
- Then the facts the agent actually found appear one by one: type, issuer, number, holder, class, scope, issue and expiry date with its state.
- A note reminds the user to confirm every value. Errors say what failed in plain words.
- Under reduced motion the page is still and the facts simply appear.

## Motion

Every animation has a job. Ease-out and springs, never linear. Under `prefers-reduced-motion` everything becomes static: the map stops twinkling, notices do not cycle, the agent page does not sweep.

| Interaction | Job |
|---|---|
| Map dots twinkle | The country is alive with notices. |
| Scroll brings the map into focus, then notices pop up | Noise becomes concrete tenders. |
| Grid glows around the pointer in the hero | The page responds to you. |
| Primary CTA pulls a few px toward the cursor | Points at the one action. |
| Agent reading beam and ticking stages | Shows the work being done. |

No custom cursors, no scroll hijacking, no loops other than the map twinkle and the agent beam.

## Voice

Plain, specific, calm. Short sentences. Name real things: SEAP, CPV, CUI, ANAF, RON, DUAE, caiet de sarcini. Numbers are real, the visitor's own, or labelled *Example*.

**Core message:** Licits finds the construction tenders you can win and prepares the offer with you. Licits never submits for you: you review everything and submit on SEAP yourself.

Words we avoid: seamless, unleash, revolutionize, elevate, next-gen, supercharge, game-changer. No em dashes in copy; use a period, comma or colon.
