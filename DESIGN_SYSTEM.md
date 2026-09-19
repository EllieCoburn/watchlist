# Watchlist — Design System

The visual reference is the Watch dashboard screenshot: warm cream page, white rounded cards, hairline borders, generous whitespace, a large serif title, quiet monospaced numbers, soft green for gains and soft rust for losses. Everything below exists to reproduce that feeling consistently, not to redesign it.

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
| `--color-canvas` | `#F6F3EC` | Page background (warm cream) |
| `--color-canvas-deep` | `#EFEBE2` | Subtle section contrast on landing, table header rows |
| `--color-surface` | `#FFFFFF` | Cards, inputs, dialogs |
| `--color-surface-muted` | `#FAF8F3` | Hover state on rows, secondary card fill |
| `--color-border` | `#E6E1D6` | Card and input borders (hairline) |
| `--color-border-strong` | `#D5CFC2` | Focused input, active segmented control |
| `--color-ink` | `#1C1B18` | Primary text, primary buttons |
| `--color-ink-secondary` | `#4A4843` | Body copy on marketing pages |
| `--color-muted` | `#77736A` | Secondary text, labels, captions (4.6:1 on canvas) |
| `--color-faint` | `#A8A398` | Tertiary text, disabled, sparkline baseline |
| `--color-gain` | `#4E7A5F` | Positive movement text/icons (5.0:1 on white) |
| `--color-gain-soft` | `#E4EEE6` | Positive badge / range indicator fill |
| `--color-loss` | `#B4573E` | Negative movement text/icons (4.6:1 on white) |
| `--color-loss-soft` | `#F5E4DD` | Negative badge fill |
| `--color-accent` | `#1C1B18` | Primary CTA background (ink, not a brand color) |
| `--color-accent-foreground` | `#FBFAF7` | Text on primary CTA |
| `--color-focus` | `#8C7B5A` | Focus ring (warm, visible on cream and white) |
| `--color-danger` | `#B4573E` | Destructive actions (shares the loss hue deliberately) |

Status colors (badges) reuse the neutrals: Planned = muted on canvas-deep, Open = gain, Closed = ink on surface-muted, Cancelled = faint.

### 2.2 Typography

Loaded with `next/font/google`, exposed as CSS variables and `@theme` font families.

| Token | Family | Use |
|---|---|---|
| `--font-serif` | **Instrument Serif** (fallback: Georgia, serif) | Page titles ("Watch"), landing headline, section headings, large hero numbers |
| `--font-sans` | **Inter** (fallback: system-ui) | Body, labels, buttons, navigation |
| `--font-mono` | **JetBrains Mono** (fallback: ui-monospace) | Prices, changes, tickers, table figures, timestamps, "MARKET OPEN" |

Type scale (rem):

| Name | Size / line | Family | Example |
|---|---|---|---|
| `display` | 3.5 / 1.0 (mobile 2.5) | serif | Landing headline |
| `title` | 2.5 / 1.1 (mobile 2.0) | serif | Page title "Watch" |
| `heading` | 1.5 / 1.25 | serif | "Watchlist", card group headings |
| `subheading` | 1.125 / 1.4 | sans, medium | Dialog titles, form section titles |
| `body` | 0.9375 / 1.6 | sans | Paragraphs |
| `label` | 0.75 / 1.2, tracking 0.08em, uppercase | mono or sans | "MARKET OPEN", "DAILY LOW", field labels |
| `price-lg` | 1.75 / 1.1, tabular | mono | Current price on a stock card |
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
White surface, 1px border, `radius-lg`, `shadow-card`, `p-6`. Hover (if clickable): border → `border-strong`, no lift.

### Buttons
- **Primary:** ink background, cream text, `radius-md`, `h-11 px-5`, sans medium. Hover: 90% opacity. 
- **Secondary:** surface background, border, ink text.
- **Ghost:** no background, muted text → ink on hover. Used for "Remove", nav items.
- **Destructive:** ghost by default; loss color text; confirmation dialog for deletes.
- All buttons: visible 2px focus ring in `--color-focus` with 2px offset.

### Inputs
Surface fill, 1px border, `radius-sm`, `h-11 px-3`, sans. Labels sit above in `label` style (sentence case for form labels, uppercase only for data captions). Error text in loss color with an icon and text, not color alone.

### Segmented control (`TimeRangeSelector`)
Pill container on `surface-muted` with border; active segment is white with `border-strong` and ink text, inactive segments muted. Keyboard: arrow keys move, it is a `radiogroup`.

### Stock card
```
┌──────────────────────────────────────────┐
│ PLTR                              ×      │  ticker mono label · remove ghost icon-button (visible on hover/focus, always on touch)
│ Palantir Technologies                    │  company sans muted
│                                          │
│ $175.00                     ╱╲__╱╲_╱     │  price-lg mono · sparkline right, 80×32, gain/loss stroke
│ +$2.14  +1.24%                           │  price mono in gain/loss color with sign; sr-only "up"/"down"
│                                          │
│ DAILY LOW               DAILY HIGH       │  label caps muted
│ $172.10  ●───────○──────  $176.80        │  PriceRangeIndicator: faint track, gain/loss dot at current position
└──────────────────────────────────────────┘
```
Whole card is a `<button>`/link for detail (later); the remove control stops propagation.

### Market status
Uppercase mono label, small dot before it: gain color when open, faint when closed. "MARKET OPEN" / "MARKET CLOSED · WEEKEND" / "MARKET CLOSED · AFTER HOURS".

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

- Recharts, no gridlines on sparklines; one faint horizontal baseline at previous close.
- Stroke 1.5px, gain/loss color, no dots, no area fill on stock cards. Performance chart may use a 6% opacity area fill.
- Axes in `faint`, mono `caption` size, tick count small.
- Tooltips: surface card with border, mono figures.

---

## 5. Copy tone

Short, plain, calm. Labels are nouns, buttons are verbs ("Add ticker", "Save scenario", "Log trade"). Avoid jargon; where a finance term is unavoidable, add a one-line plain explanation under the metric (e.g. *Expectancy — what you might expect to make, on average, per trade*).

Never: "You will make", "guaranteed", "profit" without "potential" in a scenario context.
