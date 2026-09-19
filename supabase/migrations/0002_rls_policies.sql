-- Watchlist: Row Level Security
--
-- Guarantee: a user can only SELECT / INSERT / UPDATE / DELETE rows whose owner column
-- equals auth.uid() from their verified JWT. There are no public or anon policies.
-- See DATABASE.md §4.

alter table public.profiles        enable row level security;
alter table public.watchlists      enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.trade_scenarios enable row level security;
alter table public.trades          enable row level security;

-- Belt and braces: nothing for anon, and no default grants beyond what policies allow.
revoke all on public.profiles, public.watchlists, public.watchlist_items,
              public.trade_scenarios, public.trades from anon;

-- ---------------------------------------------------------------------------
-- profiles: owner may read and update; rows are created by the auth trigger only.
-- ---------------------------------------------------------------------------
create policy "profiles: owner select" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles: owner update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- watchlists
-- ---------------------------------------------------------------------------
create policy "watchlists: owner select" on public.watchlists
  for select to authenticated using (user_id = auth.uid());

create policy "watchlists: owner insert" on public.watchlists
  for insert to authenticated with check (user_id = auth.uid());

create policy "watchlists: owner update" on public.watchlists
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "watchlists: owner delete" on public.watchlists
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- watchlist_items (user_id is denormalised; the owner trigger checks the parent list)
-- ---------------------------------------------------------------------------
create policy "watchlist_items: owner select" on public.watchlist_items
  for select to authenticated using (user_id = auth.uid());

create policy "watchlist_items: owner insert" on public.watchlist_items
  for insert to authenticated with check (user_id = auth.uid());

create policy "watchlist_items: owner update" on public.watchlist_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "watchlist_items: owner delete" on public.watchlist_items
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- trade_scenarios
-- ---------------------------------------------------------------------------
create policy "trade_scenarios: owner select" on public.trade_scenarios
  for select to authenticated using (user_id = auth.uid());

create policy "trade_scenarios: owner insert" on public.trade_scenarios
  for insert to authenticated with check (user_id = auth.uid());

create policy "trade_scenarios: owner update" on public.trade_scenarios
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "trade_scenarios: owner delete" on public.trade_scenarios
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- trades
-- ---------------------------------------------------------------------------
create policy "trades: owner select" on public.trades
  for select to authenticated using (user_id = auth.uid());

create policy "trades: owner insert" on public.trades
  for insert to authenticated with check (user_id = auth.uid());

create policy "trades: owner update" on public.trades
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "trades: owner delete" on public.trades
  for delete to authenticated using (user_id = auth.uid());
