# Watchlist — Database

Supabase Postgres. Every user-owned table has Row Level Security enabled with owner-only policies. Migrations live in `supabase/migrations/` and are applied with the Supabase CLI (`supabase db push`) or pasted into the SQL editor.

---

## 1. Entity overview

```
auth.users (Supabase)
   │ 1:1
   ▼
profiles ──────────────────────────────────────────────────┐
   │ 1:n                    1:n                 1:n         │
   ▼                         ▼                   ▼          │
watchlists              trade_scenarios        trades       │  all keyed by user_id = auth.uid()
   │ 1:n
   ▼
watchlist_items
```

---

## 2. Tables

### `profiles`
One row per auth user, created by trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | references `auth.users(id) on delete cascade` |
| `display_name` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()`, maintained by trigger |

### `watchlists`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | default `gen_random_uuid()` |
| `user_id` | `uuid` | references `auth.users(id) on delete cascade`, indexed |
| `name` | `text` | not null, 1–60 chars (check) |
| `position` | `integer` | ordering among a user's lists, default 0 |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `watchlist_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `watchlist_id` | `uuid` | references `watchlists(id) on delete cascade`, indexed |
| `user_id` | `uuid` | references `auth.users(id) on delete cascade`. Denormalised so RLS is a direct `auth.uid()` comparison |
| `ticker` | `text` | not null, uppercase, 1–10 chars (check) |
| `company_name` | `text` | nullable (filled from market data at add time) |
| `position` | `integer` | ordering within the list |
| `created_at` | `timestamptz` | |
| unique | `(watchlist_id, ticker)` | no duplicate tickers in one list |

No hard limit on items per list.

### `trade_scenarios`
Saved simulator scenarios.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | FK auth.users, indexed |
| `ticker` | `text` | not null |
| `entry_price` | `numeric(14,4)` | > 0 |
| `capital` | `numeric(14,2)` | > 0 |
| `shares` | `numeric(16,4)` | stored because the user may enter shares *or* capital; the other is derived at save time and the pair is the user's input, not a computed cache |
| `target_price` | `numeric(14,4)` | nullable |
| `stop_price` | `numeric(14,4)` | nullable |
| `note` | `text` | nullable |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `trades`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | FK auth.users, indexed |
| `ticker` | `text` | not null, uppercase |
| `company_name` | `text` | nullable |
| `status` | `trade_status` enum | `planned` · `open` · `closed` · `cancelled`, default `planned` |
| `entry_price` | `numeric(14,4)` | nullable while planned |
| `entry_date` | `date` | nullable |
| `entry_time` | `time` | nullable |
| `shares` | `numeric(16,4)` | nullable while planned |
| `capital` | `numeric(14,2)` | nullable; user-entered (may differ from shares × price due to fees/rounding) |
| `target_price` | `numeric(14,4)` | nullable |
| `stop_price` | `numeric(14,4)` | nullable |
| `exit_price` | `numeric(14,4)` | nullable; required when `closed` (check) |
| `exit_date` | `date` | nullable |
| `exit_time` | `time` | nullable |
| `notes` | `text` | nullable |
| `entry_reason` | `text` | reflection: "Why did I enter?" |
| `reflection` | `text` | reflection: "What happened?" |
| `followed_plan` | `boolean` | reflection: "Did I follow my plan?" nullable |
| `improvement` | `text` | reflection: "What would I do differently?" |
| `scenario_id` | `uuid` | nullable FK `trade_scenarios(id) on delete set null` — link when converted from a scenario |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Derived, never stored:** realized gain/loss, gain/loss %, holding duration, planned risk, planned reward, risk/reward ratio. Computed in `src/lib/finance/`.

Indexes: `trades (user_id, status)`, `trades (user_id, entry_date desc)`, `watchlist_items (watchlist_id, position)`.

---

## 3. Numeric types

- Prices: `numeric(14,4)` — supports sub-penny quotes.
- Money totals: `numeric(14,2)`.
- Shares: `numeric(16,4)` — fractional shares allowed.
- The Supabase JS client returns `numeric` as strings; the data layer parses to `number` at the boundary (`Number(value)`), and display rounding happens in `money.ts`.

---

## 4. Row Level Security

RLS is **enabled** on `profiles`, `watchlists`, `watchlist_items`, `trade_scenarios`, `trades`. There are no permissive public policies. The `anon` role has no access. Every policy is owner-only:

```sql
-- pattern used for watchlists, watchlist_items, trade_scenarios, trades
create policy "<table>: owner select" on public.<table>
  for select to authenticated using (user_id = auth.uid());
create policy "<table>: owner insert" on public.<table>
  for insert to authenticated with check (user_id = auth.uid());
create policy "<table>: owner update" on public.<table>
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "<table>: owner delete" on public.<table>
  for delete to authenticated using (user_id = auth.uid());
```

`profiles` uses `id = auth.uid()` and has **no insert policy**; rows are created only by the `handle_new_user` trigger (security definer). Users cannot delete their profile row directly; account deletion cascades from `auth.users`.

`watchlist_items.user_id` is denormalised so the item policies do not need a join to `watchlists`. A trigger (`enforce_watchlist_item_owner`) additionally asserts that the parent watchlist belongs to the same user, so a user cannot insert an item into someone else's list even with a matching `user_id`.

**Documented guarantee:** with these policies, one user can never read, insert, update or delete another user's watchlists, watchlist items, scenarios, trades, or profile, regardless of what the client sends, because every policy compares the row's owner column to `auth.uid()` from the verified JWT.

---

## 5. Triggers and functions

| Name | Purpose |
|---|---|
| `handle_new_user()` | `after insert on auth.users` → insert `profiles (id, display_name)` using `raw_user_meta_data->>'display_name'`. Also creates a default watchlist named "Watchlist" so the dashboard is never empty on first login. |
| `set_updated_at()` | `before update` on every table with `updated_at`. |
| `enforce_watchlist_item_owner()` | `before insert or update on watchlist_items` → raises if the referenced watchlist's `user_id` ≠ `new.user_id`. |

---

## 6. Migrations

```
supabase/migrations/
  0001_initial_schema.sql      # extensions, enum, tables, indexes, triggers
  0002_rls_policies.sql        # enable RLS + all policies
```

Type generation (after applying): `supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts`. A hand-written `types.ts` is committed so the project compiles before a Supabase project exists.

---

## 7. Local setup

1. Create a Supabase project.
2. Run the two migrations (SQL editor or `supabase db push`).
3. In Auth settings: enable Email provider; set Site URL to your deployment URL and add `http://localhost:3000/auth/callback` and `<site>/auth/callback` to Redirect URLs.
4. Copy `.env.example` → `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
