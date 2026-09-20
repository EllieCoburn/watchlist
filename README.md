# Watchlist

Calm, editorial financial software for retail investors: watchlists, a trade simulator with hypothetical
profit/loss scenarios, a trade journal, and plain-language analytics.

For informational and educational purposes only. Not investment advice. The app never executes trades.

## Documentation

- [PROJECT.md](./PROJECT.md): routes, component architecture, authentication, market data, roadmap
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md): tokens, typography, component specs
- [DATABASE.md](./DATABASE.md): schema, Row Level Security policies, triggers

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Supabase (Auth, Postgres, RLS), Recharts, Lucide, Vitest.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a Supabase project, then run the migrations in order in the SQL editor (or `supabase db push`):

   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_price_ticks.sql`
   - `supabase/migrations/0004_simulation_runs.sql`

3. In Supabase Auth settings enable the Email provider, set the Site URL, and add
   `http://localhost:3000/auth/callback` (and your production `/auth/callback`) to Redirect URLs.

4. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

5. Start the app:

   ```bash
   pnpm dev
   ```

## Market data

The UI talks only to `src/lib/market-data/provider.ts`. By default `MARKET_DATA_PROVIDER=mock` serves
deterministic modeled prices with no keys. Two live adapters are included:

```
# Finnhub: real-time quotes. The free tier has no historical candles, so the app fills in:
#   1W / 1M / 1Y from free end-of-day closes (Stooq, no key), and
#   Live / 1H / 1D from quotes it records into the price_ticks table as people use the app.
# Until enough recorded history exists, those ranges show today's figures and say so.
MARKET_DATA_PROVIDER=finnhub
MARKET_DATA_API_KEY=<Finnhub token>

# Daily history for 1W / 1M / 1Y on Finnhub. Polygon's free plan (5 calls/min, end-of-day bars):
HISTORY_PROVIDER=polygon
HISTORY_API_KEY=<Polygon key>

# Alpaca: batch quotes and real bars on the free IEX feed. Scales far better.
MARKET_DATA_PROVIDER=alpaca
MARKET_DATA_API_KEY=<Alpaca key id>
MARKET_DATA_API_SECRET=<Alpaca secret>
```

Keys are read on the server only. If the live provider fails, the app falls back to modeled data for that
request and says so in the status line. Other providers (Polygon, Finnhub) implement the same
`MarketDataProvider` interface and are registered in `src/lib/market-data/providers/index.ts`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm check` | Typecheck, lint, and unit tests |
| `pnpm test` | Unit tests (financial calculations, market hours, mock provider, analytics) |
| `pnpm format` | Prettier |

## Development previews

With the dev server running, these routes render each authenticated view with in-memory data so the
layout can be reviewed without a database. They return 404 in production builds.

- `/dev/watch-preview`
- `/dev/simulate-preview`
- `/dev/trades-preview`, `?view=detail`, `?view=form`
- `/dev/analytics-preview`

## Deployment

Vercel-compatible. Set the same environment variables in the project settings. `NEXT_PUBLIC_SITE_URL`
should be the deployed origin so auth emails link back correctly.

Vercel applies environment variable changes only on the next deployment. After adding or editing a
variable, trigger a redeploy from the Deployments tab or push a commit. The caption under the Watch
page's time-range selector shows which market-data provider is active.
