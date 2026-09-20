# Watchlist — Project Architecture

> Calm, editorial financial software for people who find normal financial software overwhelming.
> Stock tracking · trade planning · hypothetical P/L scenarios · trade journaling · plain-language analytics.

For informational and educational purposes only. Not investment advice. This product never executes trades.

---

## 1. Product structure

The product has two distinct layers that share one design system.

| Layer | Purpose | Access |
|---|---|---|
| **Public website** | Landing page, product explanation, feature previews, sign up / log in, pricing placeholder, terms / privacy | Anyone |
| **Authenticated application** | Watch dashboard, trade simulator, trade journal, analytics, settings | Logged-in users only. All data is private per user. |

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript) | Server components by default; client components only for interactivity |
| Styling | **Tailwind CSS v4** | CSS-first config; design tokens live in `src/app/globals.css` under `@theme` |
| Auth + DB | **Supabase** (Auth, Postgres, Row Level Security) | `@supabase/ssr` for cookie-based sessions in server components, route handlers and proxy |
| Charts | **Recharts** + inline SVG | Recharts for analytics charts; stock-card sparklines are tiny hand-rolled SVGs so they render on the server with no layout shift |
| Icons | **lucide-react** | Used sparingly |
| Fonts | `next/font/google` | Serif display, sans body, mono for numbers (see DESIGN_SYSTEM.md) |
| Tests | **Vitest** | Unit tests for financial calculation utilities and formatting |
| Lint / format | ESLint (`eslint-config-next`) + Prettier | |
| Hosting | Vercel-compatible | No custom server, no long-running processes |

No additional frameworks (no state-management library, no component kit, no ORM). Supabase's typed client is the data layer.

---

## 3. Routes

### Public

| Route | Purpose |
|---|---|
| `/` | Landing page: hero, product preview mockup, feature sections, CTAs, pricing placeholder, footer with Terms / Privacy |
| `/login` | Email + password log in |
| `/signup` | Create account |
| `/forgot-password` | Request password reset email |
| `/reset-password` | Set a new password (reached from the reset email link) |
| `/terms`, `/privacy` | Static placeholder legal pages |
| `/auth/callback` | Route handler that exchanges Supabase auth codes for a session (email confirmation, password recovery, future OAuth) |

### Authenticated (`/app/**`)

| Route | Purpose |
|---|---|
| `/app` | Authenticated home. In Phase 1 this **redirects to `/app/watch`**; later it can become an overview |
| `/app/watch` | Watch dashboard (the reference screenshot). Watchlists + stock cards |
| `/app/simulate` | Trade simulator with scenario slider; save scenario / convert to planned trade |
| `/app/trades` | Trade journal list: filters, search, sort |
| `/app/trades/new` | Create a trade |
| `/app/trades/[id]` | Trade detail: timeline, P/L, notes, reflection; chart slot for later |
| `/app/trades/[id]/edit` | Edit a trade |
| `/app/analytics` | Performance analytics |
| `/app/settings` | Display name, password change, log out, account info |

### Redirect rules

- Unauthenticated request to `/app/**` → redirect to `/login?next=<original path>`.
- Authenticated request to `/login`, `/signup`, `/forgot-password` → redirect to `/app`.
- Enforced in two places: `src/proxy.ts` (Next.js 16 request proxy, formerly middleware) for fast redirects and session cookie refresh, **and** in the `/app` layout server component, which re-verifies the user with `supabase.auth.getUser()` so a proxy bypass can never leak a page.

### File layout (App Router)

```
src/
  app/
    layout.tsx                 # root: fonts, globals.css, <html lang>
    globals.css                # Tailwind v4 + @theme design tokens
    (marketing)/
      layout.tsx               # public header/footer
      page.tsx                 # landing
      terms/page.tsx
      privacy/page.tsx
    (auth)/
      layout.tsx               # centered card layout
      login/page.tsx
      signup/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
    auth/
      callback/route.ts        # code exchange
      signout/route.ts         # POST → sign out
    app/
      layout.tsx               # verifies user, renders AppShell (nav)
      page.tsx                 # redirect → /app/watch
      watch/page.tsx
      simulate/page.tsx
      trades/page.tsx
      trades/new/page.tsx
      trades/[id]/page.tsx
      trades/[id]/edit/page.tsx
      analytics/page.tsx
      settings/page.tsx
  components/
    ui/                        # primitives: Button, Card, Input, Label, Select, Badge, Dialog, Tabs, Skeleton
    layout/                    # MarketingHeader, MarketingFooter, AppShell, AppNav, MobileNav, PageHeader
    watch/                     # StockCard, SparklineChart, WatchlistSection, TimeRangeSelector, MarketStatus, PriceRangeIndicator, AddTickerForm, WatchlistSwitcher
    simulate/                  # TradeSimulator, ScenarioSlider, ProfitLossDisplay, RiskRewardDisplay, SimulatorForm
    trades/                    # TradeCard, TradeTable, TradeStatusBadge, TradeDetail, TradeForm, TradeFilters
    analytics/                 # AnalyticsMetric, PerformanceChart, TickerBreakdown, OutcomeBreakdown
    marketing/                 # Hero, FeatureSection, ProductPreview, PricingPlaceholder
  lib/
    supabase/
      client.ts                # browser client
      server.ts                # server client (cookies)
      proxy.ts                 # session refresh helper used by src/proxy.ts
      types.ts                 # generated Database types
    market-data/
      types.ts                 # Quote, PricePoint, MarketStatus, TimeRange, MarketDataProvider
      provider.ts              # getQuote / getHistoricalPrices / getMarketStatus facade → active provider
      providers/mock.ts        # deterministic mock provider
      providers/index.ts       # provider selection by env
      symbols.ts               # mock symbol directory (ticker → company name)
    finance/
      calculations.ts          # calculateShares, calculatePositionValue, ... (pure, tested)
      analytics.ts             # aggregate trade metrics (pure, tested)
      money.ts                 # rounding + formatting helpers (pure, tested)
    data/                      # server-side data access (watchlists.ts, trades.ts, scenarios.ts, profiles.ts)
    actions/                   # server actions (watchlists.ts, trades.ts, scenarios.ts, auth.ts, profile.ts)
    validation/                # zod-free, hand-written validators for form input (keep deps minimal)
    utils.ts                   # cn(), date helpers
  proxy.ts                     # Next.js request proxy: session refresh + auth redirects
supabase/
  migrations/                  # SQL migrations (see DATABASE.md)
  config.toml                  # (optional) local dev config
```

---

## 4. Authentication architecture

- **Provider:** Supabase Auth, email + password initially. Google OAuth can be added later by enabling the provider in Supabase and adding one button that calls `signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback' } })`. The callback route already handles the code exchange, so nothing else changes.
- **Session handling:** `@supabase/ssr` stores the session in cookies. Three clients:
  - `createBrowserClient` — client components (rarely needed; most mutations go through server actions).
  - `createServerClient` with `cookies()` — server components, route handlers, server actions.
  - Proxy helper — refreshes the session on every request and sets updated cookies.
- **Authorization:** `supabase.auth.getUser()` (which validates against the Auth server) is the source of truth for "is this person logged in", never `getSession()` alone.
- **Profiles:** a `profiles` row is created automatically by a Postgres trigger on `auth.users` insert (see DATABASE.md).
- **Flows:**
  - Sign up → Supabase sends confirmation email (if enabled in project settings) → `/auth/callback` → `/app`.
  - Log in → server action → redirect to `next` or `/app`.
  - Log out → `signOut` server action (Settings) or `POST /auth/signout` → redirect `/`.
  - Forgot password → `resetPasswordForEmail` with `redirectTo=/auth/callback?next=/reset-password` → user sets new password.
- **Server-side only secrets:** only the anon key is public (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The service-role key is never used in the app. Market-data API keys are server-only env vars.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=            # used for auth redirect URLs
MARKET_DATA_PROVIDER=mock        # mock | alpaca (polygon / finnhub can be added the same way)
MARKET_DATA_API_KEY=             # server-only, never NEXT_PUBLIC_
MARKET_DATA_API_SECRET=          # Alpaca secret key
```

---

## 5. Market data architecture

The UI never talks to a stock API directly. Everything goes through `src/lib/market-data/provider.ts`:

```ts
getQuote(symbol): Promise<Quote>
getQuotes(symbols): Promise<Quote[]>
getHistoricalPrices(symbol, range: TimeRange): Promise<PricePoint[]>
getMarketStatus(): Promise<MarketStatus>
searchSymbols(query): Promise<SymbolMatch[]>
```

- `TimeRange = 'live' | '1H' | '1D' | '1W' | '1M' | '1Y'`
- A `MarketDataProvider` interface is implemented by `providers/mock.ts` (deterministic: a daily random walk plus an intraday bridge, so refreshes never rewrite history) and `providers/alpaca.ts` (Alpaca Market Data, free IEX feed). Polygon/Massive or Finnhub adapters implement the same interface and are registered in `providers/index.ts`.
- Live providers are wrapped in `providers/resilient.ts`: any failure falls back to the mock for that call and the data label reads "modeled · live data unavailable" for a minute.
- `cache.ts` de-duplicates in-flight requests and caches quotes (10s) and series (30s to 1h by range) per server instance to respect provider rate limits.
- `getPricesBetween(symbol, from, to)` powers the price chart on a trade's detail page.
- The facade is `server-only`. Client components receive quotes as props from server components, or poll a route handler (`/api/market/quotes?symbols=...`) that calls the facade. Secrets stay on the server.
- Polling: the Watch page client polls every 10 seconds when the "Live" range is selected and the tab is visible; the status line reads "polling every 10s".
- `MarketStatus = { state: 'open' | 'closed' | 'pre' | 'after', label: 'MARKET OPEN' | 'MARKET CLOSED · WEEKEND' | ..., nextChangeAt }`, computed from US market hours (America/New_York) in the mock provider; a real provider can return the exchange's own status.

---

## 6. Component architecture

Principles: small components, server components by default, client boundary as low in the tree as possible, no giant components.

| Area | Component | Kind | Responsibility |
|---|---|---|---|
| Layout | `AppShell` | server | Renders `AppNav` + content area for `/app/**` |
| | `AppNav` / `MobileNav` | client | Top nav (desktop) / bottom tab bar (mobile). Sections: Watch, Simulate, Trades, Analytics; account icon → Settings |
| | `PageHeader` | server | Large serif title + optional status line + right-aligned slot |
| Watch | `MarketStatus` | server | "MARKET OPEN" / "MARKET CLOSED · WEEKEND" |
| | `TimeRangeSelector` | client | Live · 1H · 1D · 1W · 1M · 1Y segmented control |
| | `WatchlistSection` | client | Heading, count, add-ticker form, grid of `StockCard`s, watchlist switcher (create/rename/delete) |
| | `StockCard` | server-safe | Ticker, name, price, change and %, sparkline, day low/high, `PriceRangeIndicator`; remove control passed in as a slot |
| | `SparklineChart` | server-safe | Tiny inline-SVG area line, colored by direction |
| | `PriceRangeIndicator` | server-safe | Position of current price between low and high |
| Simulate | `TradeSimulator` | client | Owns form state, calls pure calc utils, renders sub-displays |
| | `ScenarioSlider` | client | Hypothetical price slider + "If X reaches $Y" readout |
| | `ProfitLossDisplay` | server-safe | Value / gain / % with sign words ("gain"/"loss") not just color |
| | `RiskRewardDisplay` | server-safe | Target vs stop with ratio |
| Trades | `TradeTable` / `TradeCard` | server-safe | Table on desktop, cards on mobile |
| | `TradeStatusBadge` | server-safe | Planned / Open / Closed / Cancelled |
| | `TradeFilters` | client | Status tabs, search, sort (URL search params) |
| | `TradeForm` | client | Create/edit form → server action |
| | `TradeDetail` | server | Timeline, numbers, notes, reflection, chart slot |
| Analytics | `AnalyticsMetric` | server-safe | Label, plain-language description, value |
| | `PerformanceChart` | client | Cumulative realized P/L over time |
| | `OutcomeBreakdown`, `TickerBreakdown` | client | Simple bar charts |

"server-safe" = no hooks, can be rendered from either side.

---

## 6b. Probability calculator (`src/lib/quant/`)

The Simulate page's central feature: a first-passage (barrier-hitting) model answering "does the entry fill, and once filled, which level is touched first?" Full methodology in `docs/SIMULATE_METHODOLOGY.md`; the audit of the first-generation model in `docs/SIMULATE_AUDIT.md`.

| Module | Responsibility |
|---|---|
| `path-eval.ts` | The single definition of touch, fill, first and ambiguous, applied to any bar sequence |
| `data-window.ts` | Point-in-time data slice (daily, intraday, benchmark) used by engines and the backtest |
| `engine-mc.ts` | Engine A: parametric Monte Carlo, μ = 0, Student-t innovations, EWMA σ split into gap/intraday with the realized intraday profile, bridge-sampled bar extremes, refinement of ambiguous steps |
| `features.ts`, `engine-analog.ts` | Engine B: point-in-time feature vectors (stock + QQQ context), weighted similarity, replay of the K nearest sessions' actual intraday paths, MFE/MAE distributions |
| `engine-bootstrap.ts` | Engine C: regime-conditioned gaps + hour-block bootstrap of real 1-/5-minute bars (daily bridge fallback) |
| `combine.ts`, `checks.ts` | Convex combination with backtest-derived weights; automated identity checks |
| `backtest.ts` | Walk-forward calibration: Brier, log loss, reliability buckets, ECE per engine |
| `reference.ts`, `calendar.ts`, `events.ts` | Reference price (last close / live extended hours / intraday), trading-calendar horizons, event flags |
| `confidence.ts`, `explain.ts` | Measured confidence; template-based explanation (no language model) |
| `engine.ts`, `validate.ts` | Orchestration into a serializable `SimulationResult`; request validation |

Data: `getDailyBars`, `getIntradayHistory` and the benchmark come from the provider facade; the resilient wrapper never substitutes modeled data for these, and `POST /api/simulate` returns "Unable to calculate probability because required market data is unavailable" instead. Every run is stored in `simulation_runs` with its seed.

## 7. Financial calculation utilities (`src/lib/finance/`)

All pure, all unit-tested, all operating on plain numbers with explicit rounding at the boundary.

- `calculateShares(capital, price)`
- `calculatePositionValue(shares, price)`
- `calculateProfitLoss(shares, entryPrice, exitPrice)`
- `calculateReturnPercentage(entryPrice, exitPrice)`
- `calculateTargetProfit(shares, entryPrice, targetPrice)`
- `calculateStopLoss(shares, entryPrice, stopPrice)`
- `calculateRiskReward(entryPrice, targetPrice, stopPrice)`
- `calculateExpectancy(winRate, avgWin, avgLoss)`
- `calculateHoldingDuration(entry, exit)`
- `analytics.ts`: `summarizeTrades(trades)` → all analytics metrics.

Money handling: calculations run in floating point but every displayed value passes through `roundMoney()` (2 dp, `Math.round(x * 100) / 100` with epsilon) and `formatMoney()` / `formatPercent()` / `formatSignedMoney()` (Intl.NumberFormat, en-US, USD). Shares are shown to 2 dp for fractional shares.

---

## 8. Accessibility commitments

- Semantic landmarks (`header`, `nav`, `main`, `section` with headings).
- Every form control has a visible `<label>`.
- All interactive controls are native buttons/links/inputs or have full keyboard handling and focus rings.
- Gain/loss is never color-only: signs (+/−), words ("gain", "loss"), and icons/arrows where useful.
- Text contrast ≥ 4.5:1 for body, ≥ 3:1 for large display text (tokens chosen accordingly).
- Charts have `aria-label` summaries; sparklines are decorative (`aria-hidden`) with the numbers visible next to them.

---

## 9. Implementation roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **1** | Project scaffold, design tokens, UI primitives, landing page, auth pages + flows, protected app shell with navigation, Supabase migrations + RLS, placeholder app pages | `tsc`, `lint`, `test` pass; can sign up, log in, log out, reset password; `/app` protected |
| **2** | Watch dashboard matching reference: mock market data, watchlists CRUD persisted to Supabase, stock cards, time range selector, polling, responsive grid | Visual match; multiple watchlists; add/remove tickers; mobile stacking |
| **3** | Trade simulator, scenario slider, finance utilities + tests, save scenarios, convert to planned trade | All calcs tested; simulator is beginner-readable |
| **4** | Trade journal: create/edit/delete, list with filters/search/sort, detail page with chart slot | CRUD works; derived metrics correct |
| **5** | Analytics: metrics, performance chart, ticker breakdowns, outcome breakdown | Plain-language labels; empty state |
| **6** | Alpaca adapter behind the same interface, TTL cache, resilient fallback, date-range history, trade price chart | Switch via env var; UI unchanged |
| **7** | Accessibility pass, mobile polish, loading / error / empty states, performance | Lighthouse a11y ≥ 95; no layout shift on data load |

After each phase: `pnpm typecheck && pnpm lint && pnpm test`, fix everything, commit.

**Status:** all seven phases are implemented. Verified in this environment: typecheck, lint, 71 unit tests, production build, axe-core scan (0 violations on 11 pages), keyboard navigation, and desktop / tablet / mobile screenshots of every view via the `/dev/*-preview` routes. Not yet verified: the authenticated flows against a live Supabase project (the build sandbox could not reach supabase.co).

---

## 10. Product language rules

- Never imply guaranteed outcomes. Prefer "Potential profit", "If the stock reaches…", "Hypothetical outcome", "Scenario".
- All simulator output is labeled **Hypothetical**.
- Disclaimer shown on landing footer, simulator, analytics, and app footer:
  *For informational and educational purposes only. Not investment advice.*
