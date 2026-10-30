# DESIGN.md: Licits

The source of truth is the Licits Design System artifact. Code tokens live as CSS variables in `app/globals.css` and are mapped to Tailwind names in `tailwind.config.ts` (`paper`, `raised` = surface, `sunk`, `ink`, `ink-2`, `muted`, `line`, `line-strong`, `indigo*`, `ribbon-1..4`, `night`, `eligible`, `warn`, `risk`; radius `field` 8px, `card` 16px, `pill`; shadow `lift-1`, `lift-2`). Use this file to brief AI design tools so generated screens stay on brand.

## Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `paper` | `#f7f8fa` | `#0b1020` | Page background. Cool off-white, never warm cream. |
| `surface` | `#ffffff` | `#121829` | Cards, inputs, the waitlist field, raised panels on paper. |
| `surface-sunk` | `#eef0f5` | `#0e1424` | Sunk areas: slider tracks, the 'Before' column, code and data wells. |
| `ink` | `#0b1020` | `#eef0f6` | Headlines and body text on paper or surface. Never pure black. |
| `ink-2` | `#2a3245` | `#c5cad8` | Secondary text, second half of a two-tone headline. |
| `muted` | `#5b6478` | `#8f98ad` | Captions, helper text, labels. Passes 4.5:1 on paper and surface in both themes. |
| `line` | `#e3e6ed` | `#232b40` | Hairline borders on cards and dividers. 1px only. |
| `line-strong` | `#8a93a8` | `#4b5570` | Input borders and control outlines (3:1 against surface). |
| `indigo` | `#4f46e5` | `#4f46e5` | THE accent. Primary CTA fill, focus ring, active state. One filled CTA per section. |
| `indigo-deep` | `#3730a3` | `#3730a3` | Primary CTA pressed state. |
| `indigo-text` | `#4338ca` | `#a5a0ff` | Links and indigo text on paper or surface. |
| `indigo-soft` | `#eef0ff` | `#1d1f4a` | Selected rows, soft tags, the 'With Licits' column wash. |
| `on-indigo` | `#ffffff` | `#ffffff` | Text on indigo (6.3:1). |
| `ribbon-1` | `#4f46e5` | `#6d66ff` | Signal ribbon stop 1 (start). Gradient lives ONLY in the ribbon, the logo mark and the cover. |
| `ribbon-2` | `#8b5cf6` | `#9b7bff` | Signal ribbon stop 2. |
| `ribbon-3` | `#ff6b5a` | `#ff7d6e` | Signal ribbon stop 3. |
| `ribbon-4` | `#ffb020` | `#ffbe45` | Signal ribbon end and the match node. Also the dot in the logo. |
| `night` | `#0b1020` | `#060912` | The one dark closing band on the landing page and the logo tile. |
| `on-night` | `#eef0f6` | `#eef0f6` | Text on night. |
| `eligible` | `#067a52` | `#3dd598` | Eligible state text and icon. Status only, never decoration. |
| `eligible-bg` | `#e5f6ee` | `#0f2a22` | Eligible chip background. |
| `warn` | `#a14306` | `#f7b955` | Partial match, approaching deadline. |
| `warn-bg` | `#fff3e0` | `#2e2210` | Warn chip background. |
| `risk` | `#c4320a` | `#ff8a7a` | Not eligible, missed requirement, form error text. |
| `risk-bg` | `#fdecea` | `#2e1414` | Risk chip background. |

## Typography

Geist (`--font-sans`) for everything readable, Geist Mono (`--font-mono`) for data only. Tabular figures on all numbers.

| Style | Family | Size / line | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `display-xl` | sans | 64px / 68px | 300 | -2.2px | Hero headline only. 36px on mobile. |
| `display` | sans | 44px / 50px | 300 | -1.3px | Section headlines. |
| `title` | sans | 26px / 32px | 400 | -0.5px | Card and step titles. |
| `lead` | sans | 19px / 29px | 400 | -0.1px | Hero subtext and section intros. Max 65ch. |
| `body` | sans | 15px / 23px | 400 | 0 | Default UI and body copy. |
| `label` | sans | 13px / 18px | 500 | 0 | Form labels, button text at small size, nav. |
| `caption` | sans | 12px / 16px | 400 | 0 | Helper text, footnotes, the 'Example' label. |
| `data-lg` | mono | 44px / 48px | 400 | -1.5px | The big calculator result and live counters. Tabular figures. |
| `data` | mono | 13px / 18px | 500 | 0 | Tender IDs, CPV codes, RON values, dates. Every number on the page. |

## Spacing, radius, elevation

- 8px base: 4, 8, 12, 16, 24, 32, 48, 96. Section padding 96px desktop, 64px mobile. Container 1200px, 16px mobile gutter.
- Radius: inputs and inner chips 8px, cards 16px, every button and tag a pill.
- Shadows: `0 1px 3px rgba(16,24,64,.08)` resting; `0 12px 32px rgba(16,24,64,.10), 0 2px 6px rgba(16,24,64,.05)` floating.

Licits helps Romanian SMEs win public tenders. It reads every SEAP notice, shows which ones a company can actually win, and drafts the offer with them. This is the brand book for the pre-launch landing page and, after that, the whole app.

The name is plural for *licit*, from *licitație* (tender): Licits means "tenders", so the product is clear at a glance. The core image is a signal: thousands of notices flow in as noise, and Licits narrows them into one clear line, the tender you can win.

## Messaging

**The job customers hire us for:** win public contracts without having a bid team. They are not buying AI. They want a signed contract and their evenings back.

**Core message:** Licits finds the tenders you can win and prepares the offer with you.

**Proof points we can state** (all live in the product):
- A shortlist by email every morning.
- A reminder before every deadline.
- Every requirement checked against the company file.
- The buyer's past tenders: who won and how, so the offer is shaped by what has won before.
- A first pass takes about 10 minutes per tender, against hours by hand.

**Hero (draft)**
- Headline: *Win the public tenders you've been missing.*
- Subtext (20 words max): *Licits reads every SEAP notice, shows which ones you can win, and drafts the offer with you.*
- One CTA label on the whole page: **Join the waitlist**. Email only. Company details come later.

**Page narrative**, top to bottom:
1. Hero, waitlist form, ribbon ending in a real tender card.
2. Live SEAP strip: tenders scanned this week, fed by our own sync. Hidden if the number is unavailable. Never invented.
3. The loss: *Every week, tenders you could win close before you see them.*
4. Before / With Licits, side by side (component: BeforeAfter).
5. How it works: Monitor, Qualify, Draft, Submit. Each step shows the real product component.
6. Hours back: the visitor's own numbers in, hours per month out (component: HoursCalculator). Our assumption is printed next to the result.
7. Trust: official SEAP data, you approve every step, GDPR, data stays in the EU.
8. FAQ and the closing waitlist on the one dark band.

**Persuasion, used honestly**

| Principle | Where |
|---|---|
| Loss aversion | Section 3 names the cost of doing nothing. |
| Contrast | Before / With Licits. |
| Present bias | "Tomorrow morning, your first shortlist." |
| Low activation energy | One field in the hero. |
| Authority | SEAP and e-licitatie.ro named as sources. |
| Pratfall | "Licits never submits for you. You stay in control." |
| Scarcity | Early access is real and capped by onboarding capacity. No fake counters. |

**Voice.** Plain, specific, calm. Short sentences. Name real things: SEAP, CPV, RON, caiet de sarcini. Numbers are either real, the visitor's own, or labelled *Example*.

Words we avoid: seamless, unleash, revolutionize, elevate, next-gen, supercharge, game-changer. No em dashes anywhere in copy; use a period, comma or colon.

## Visual foundations

**Color.** Cool neutrals with one accent.
- `paper` page, `surface` cards, `ink` text, `muted` captions, `line` hairlines.
- `indigo` is the only action color: one filled pill CTA per section. Links use `indigo-text`.
- The ribbon gradient (`ribbon-1` to `ribbon-4`, indigo to violet to coral to amber) appears in exactly three places: the hero ribbon, the logo mark, the cover. Never on text, buttons, glows or backgrounds.
- `eligible`, `warn`, `risk` are states. They never decorate.
- `night` is used once on the landing page: the closing waitlist band.

**Type.** Geist for everything readable, light (300) at display sizes with negative tracking. Geist Mono for data only: tender IDs, CPV codes, RON values, deadlines, counters. The mono layer is the brand's signature: it makes the page feel like it is reading real data.

**Shape.** Pills for every button and tag (`radius-pill`), 16px cards (`radius-lg`), 8px inputs and inner chips (`radius-sm`). Hairline borders first; `shadow-2` only for the floating card and hover.

**Layout.** Split hero, text left, ribbon and card right. Max 1200px container, 96px section padding. At least five different layout families on one page; never three identical cards in a row; max three small uppercase eyebrows on the whole page.

**What makes it not Stripe.** Stripe tilts a blob mesh across the hero top. Licits runs a horizontal ribbon that *converges* into one line and lands on a product card: the image tells the noise to signal story. Mono data, cool paper, indigo to amber instead of indigo to pink.

## Motion

Every animation has a job. Springs, not linear easing. Under `prefers-reduced-motion` all of it becomes static.

| Interaction | Job |
|---|---|
| Ribbon strands lean toward the cursor | The signal finds you. |
| Hero card tilts up to 4 degrees and its checks tick in on hover | Shows the product working. |
| Primary CTA pulls 4 to 6px toward the cursor | Points at the one action. |
| Spotlight border on cards follows the cursor | Shows which card you are reading. |
| Calculator result counts to the new value | Feedback on your input. |

No custom cursors, no scroll cues, no parallax hijacks, no infinite loops outside the ribbon.

## Iconography

The app already uses Material Symbols Outlined (weight 300). Keep one family, outlined, 20px in UI, ink or muted. Icons never carry color alone.

## Logo

The mark: four ribbon strands converging on an amber dot, on a `night` tile with `radius-lg` corners. The wordmark: *licits* in lowercase Geist 600, tracking -0.5px, next to the mark. See the Logo component for the lockup. The bare mark (no tile) is for dark backgrounds.

## Open questions

- Domain: licits.com.
- The hero video replaces the coded ribbon only after this look is approved.
