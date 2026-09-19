# Watchlist — Design System

The visual reference is the Watch dashboard screenshot: warm off-white page, white rounded cards with almost no visible border, generous whitespace, a large serif title, monospaced numbers and captions, soft green for gains and soft rust for losses. Everything below exists to reproduce that feeling consistently, not to redesign it.

### What the reference shows (recorded so it survives without the image)

- Top-left: **Watch** in a large serif; beneath it a small dot + `MARKET CLOSED · WEEKEND` in spaced uppercase, muted.
- Top-right: a pill segmented control on a slightly darker warm gray track — `Live 1H 1D 1W 1M 1Y` in mono, the active item (`1D`) a black pill with white text. Beneath it, right-aligned mono caption `polling every 10s · modeled history`.
- A full-width hairline divider under the header.
- **Watchlist** serif heading, with `3 of 3` in mono on the right.
- Three white cards per row, ~20px radius, no perceptible border, a barely-there shadow. Inside each: ticker in **bold mono** (`AAPL`), company in sans muted (`Apple Inc`), a small `×` top-right; a large mono price with **no currency symbol** (`336.13`) followed on the same baseline by the change `−1.77 −0.53%` in rust or green mono; a sparkline **area** chart (thin line, very light fill in the same hue); then a thin gray range track with a short vertical tick in the gain/loss color at the current price position; `LOW 332.53` left and `HIGH 338.49` right in mono uppercase muted.
- Below the grid: `+ ADD A LINE OF THREE` in mono uppercase muted (adds another row of card slots), then a dashed-border pill `+ NEW WATCHLIST`.
- Footer line: `1 watchlist · 3 tracked · 1d high & low` left, live clock `12:12:53` right, both mono muted.

> If a decision is ambiguous, prioritise in order: simplicity → visual calm → readability → intuitive understanding → whitespace → consistency.

---

## 1. Personality

- **Editorial, not dashboard.** Think a well-set financial newspaper page, not a trading terminal.
- **Quiet.** Nothing blinks, glows, or competes. Motion is limited to gentle fades and value transitions.
- **Numbers are the content.** Type is chosen so figures line up and read at a glance.
- **Color means something.** Green and rust are used only for gain/loss and status; everything else is neutral.

Explicitly avoided: bright gradients, neon green, dark "crypto" themes, dense multi-panel layouts, icon clutter, drop shadows with visible depth, heavy borders.

---

## 2. Design tokens

Tokens are defined once in `src/app/globals.css` under Tailwind v4's `@theme` and consumed as utility classes (`bg-canvas`, `text-muted`, `text-gain`, …). Never hard-code hex values in components.

### 2.1 Color

| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#F4F3EF` | Page background (warm off-white, as in the reference) |
| `--color-canvas-deep` | `#E9E8E3` | Segmented-control track, range-indicator track, skeletons, subtle section contrast |
| `--color-surface` | `#FFFFFF` | Cards, inputs, dialogs |
| `--color-surface-muted` | `#FAF8F3` | Hover state on rows, secondary card fill |
| `--color-border` | `#E6E4DE` | Hairline dividers and input borders; cards use it at 60% opacity so it is barely perceptible |
| `--color-border-strong` | `#D3D1CA` | Focused input, dashed "new watchlist" button, hovered card |
| `--color-ink` | `#1C1B18` | Primary text, primary buttons |
| `--color-ink-secondary` | `#4A4843` | Body copy on marketing pages |
| `--color-muted` | `#6B675E` | Secondary text, labels, captions (≥ 4.5:1 on every surface, including the segmented-control track) |
| `--color-faint` | `#99948A` | Decorative only: icon-only controls, placeholders, tracks. Never body text (fails 4.5:1) |
| `--color-gain` | `#6E9A7C` | Positive movement text, sparkline stroke, range tick (use `--color-gain-text` for small text) |
| `--color-gain-text` | `#466F57` | Positive change text ≥ 4.5:1 on every surface |
| `--color-gain-soft` | `#EEF4EF` | Sparkline area fill, positive badge fill |
| `--color-loss` | `#C98A6E` | Negative movement sparkline stroke and range tick (salmon) |
| `--color-loss-text` | `#A64C34` | Negative change text ≥ 4.5:1 on every surface |
| `--color-loss-soft` | `#F8EEE9` | Sparkline area fill, negative badge fill |
| `--color-accent` | `#1C1B18` | Primary CTA background (ink, not a brand color) |
| `--color-accent-foreground` | `#FBFAF7` | Text on primary CTA |
| `--color-focus` | `#8C7B5A` | Focus ring (warm, visible on cream and white) |
| `--color-danger` | `#A64C34` | Destructive actions (shares the loss text hue deliberately) |

Status colors (badges) reuse the neutrals: Planned = muted on canvas-deep, Open = gain, Closed = ink on surface-muted, Cancelled = faint.

### 2.2 Typography

Loaded with `next/font/google`, exposed as CSS variables and `@theme` font families.

| Token | Family | Use |
|---|---|---|
| `--font-serif` | **Instrument Serif** (fallback: Georgia, serif) | Page titles ("Watch"), section headings ("Watchlist"), landing headline |
| `--font-sans` | **Inter** (fallback: system-ui) | Company names, body copy, form labels, buttons on marketing pages |
| `--font-mono` | **IBM Plex Mono** (fallback: ui-monospace) | Tickers, prices, changes, segmented control, captions, uppercase status labels, clock — the reference uses mono for nearly all small UI text |

Type scale (rem):

| Name | Size / line | Family | Example |
|---|---|---|---|
| `display` | 3.5 / 1.0 (mobile 2.5) | serif | Landing headline |
| `title` | 2.5 / 1.1 (mobile 2.0) | serif | Page title "Watch" |
| `heading` | 1.5 / 1.25 | serif | "Watchlist", card group headings |
| `subheading` | 1.125 / 1.4 | sans, medium | Dialog titles, form section titles |
| `body` | 0.9375 / 1.6 | sans | Paragraphs |
| `label` | 0.75 / 1.2, tracking 0.08em, uppercase | mono | "MARKET OPEN", "LOW 332.53", "+ NEW WATCHLIST" |
| `ticker` | 1.0 / 1.2, bold, tracking 0.04em | mono | Card ticker |
| `price-lg` | 2.25 / 1.0, tabular | mono | Current price on a stock card (no currency symbol on cards) |
| `price` | 1.0 / 1.2, tabular | mono | Table figures, change values |
| `caption` | 0.75 / 1.4 | sans | "polling every 10s", helper text |

All numeric text uses `font-variant-numeric: tabular-nums`.

### 2.3 Spacing and layout

- Base unit 4px; use Tailwind's scale. Common rhythm: `gap-6` between cards, `p-6` inside cards (`p-5` on mobile), `py-10`–`py-16` between page sections.
- Page container: `max-w-[1320px] mx-auto px-6 md:px-10`. Desktop keeps the wide, airy horizontal layout of the reference.
- Watch grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6`. Any number of rows.
- App content top padding is large (`pt-10 md:pt-14`) so the serif title breathes.

### 2.4 Radius, borders, shadow

| Token | Value |
|---|---|
| `--radius-sm` | 8px (inputs, badges) |
| `--radius-md` | 14px (buttons, segmented control) |
| `--radius-lg` | 20px (cards) |
| `--radius-xl` | 28px (landing preview frame, dialogs) |
| Border | 1px `--color-border` |
| `--shadow-card` | `0 1px 2px rgba(28,27,24,0.04)` — barely there |
| `--shadow-pop` | `0 12px 32px rgba(28,27,24,0.08)` — dialogs and menus only |

### 2.5 Motion

- Durations: 150ms (hover/focus), 250ms (dialogs, panel reveal).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Numbers updating from polling cross-fade; no flashing backgrounds.
- Respect `prefers-reduced-motion`: disable transitions.

### 2.6 Breakpoints

Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Mobile-first.

---

## 3. Core components (visual spec)

### Card
White surface, `radius-lg`, `shadow-card`, 1px border at 60% opacity (effectively invisible against the off-white page, present for contrast on any lighter background), `p-6`. Hover (if clickable): border → `border-strong`, no lift.

### Buttons
- **Primary:** ink background, cream text, `radius-md`, `h-11 px-5`, sans medium. Hover: 90% opacity. 
- **Secondary:** surface background, border, ink text.
- **Ghost:** no background, muted text → ink on hover. Used for "Remove", nav items.
- **Destructive:** ghost by default; loss color text; confirmation dialog for deletes.
- All buttons: visible 2px focus ring in `--color-focus` with 2px offset.

### Inputs
Surface fill, 1px border, `radius-sm`, `h-11 px-3`, sans. Labels sit above in `label` style (sentence case for form labels, uppercase only for data captions). Error text in loss color with an icon and text, not color alone.

### Segmented control (`TimeRangeSelector`)
Fully rounded pill track in `canvas-deep`, no border, `p-1`. Items in mono `0.875rem`, muted; the active item is an **ink pill with cream text**. Keyboard: arrow keys move, it is a `radiogroup`.

### Stock card
```
┌──────────────────────────────────────────┐
│ AAPL                              ×      │  ticker bold mono · remove ghost icon-button, muted
│ Apple Inc                                │  company sans muted
│                                          │
│ 336.13  −1.77 −0.53%                     │  price-lg mono (no $) · change + % on the same baseline, loss/gain text color, sign always present
│                                          │
│   ╱╲╲__╱╲╲_╱╲  (area sparkline)          │  full card width, ~96px tall, 1.5px stroke + very light fill in the same hue
│ ────────────┃───────────────────────     │  PriceRangeIndicator: 2px canvas-deep track, short vertical tick in gain/loss color at current position
│ LOW 332.53                 HIGH 338.49   │  mono label caps muted
└──────────────────────────────────────────┘
```
Whole card is a `<button>`/link for detail (later); the remove control stops propagation. A visually hidden "up"/"down" word accompanies the change so direction is not color-only.

### Below the grid
- `+ ADD A LINE OF THREE`: mono uppercase ghost button, muted → ink on hover. Adds another row of three empty add-ticker slots.
- `+ NEW WATCHLIST`: dashed 1px `border-strong` pill, mono uppercase, `px-6 h-14`.
- Footer status line: mono caption muted, `1 watchlist · 3 tracked · 1d high & low` left, live `HH:MM:SS` clock right.

### Market status
Uppercase mono label with 0.08em tracking, muted, small filled dot before it: gain color when open, faint when closed. "MARKET OPEN" / "MARKET CLOSED · WEEKEND" / "MARKET CLOSED · AFTER HOURS".

### Gain / loss display
Sign always present (`+$114.28`, `−$57.14`, true minus sign U+2212). Color from tokens. Accompanying word where space allows: "Potential profit", "Potential loss". Never color alone.

### Badges (`TradeStatusBadge`)
`radius-sm`, `px-2 py-0.5`, label style, soft fill + matching text; includes text so color is redundant.

### Navigation
- **Desktop:** slim top bar on canvas (no card), wordmark in serif left, four text links center-left in sans, account icon right. Active link is ink with a 1px underline offset; inactive muted.
- **Mobile:** bottom tab bar, surface with top border, four items with small Lucide icon + label; Settings via account icon in the page header.

### Empty states
Serif heading, one sentence of muted body copy, one primary action. No illustrations.

### Loading
Skeleton blocks in `canvas-deep` with `radius-sm`, no shimmer animation stronger than a slow pulse.

---

## 4. Charts

- Recharts, no gridlines or axes on sparklines.
- Stock-card sparkline: 1.5px stroke in gain/loss color, no dots, area fill in the matching `-soft` token (as in the reference). Performance chart uses the same treatment in ink/gain.
- Axes in `faint`, mono `caption` size, tick count small.
- Tooltips: surface card with border, mono figures.

---

## 5. Copy tone

Short, plain, calm. Labels are nouns, buttons are verbs ("Add ticker", "Save scenario", "Log trade"). Avoid jargon; where a finance term is unavoidable, add a one-line plain explanation under the metric (e.g. *Expectancy — what you might expect to make, on average, per trade*).

Never: "You will make", "guaranteed", "profit" without "potential" in a scenario context.
