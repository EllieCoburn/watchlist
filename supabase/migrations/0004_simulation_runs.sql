-- Watchlist: simulation runs (audit trail for the probability calculator)
--
-- Every Simulate run stores its inputs, the statistics derived from real market data,
-- the Monte Carlo configuration (seed, paths, calibration) and the full result, so any
-- probability shown to a user can be reproduced and inspected later.

create table public.simulation_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  ticker         text not null check (char_length(ticker) between 1 and 10),
  model_version  text not null,
  entry_price    numeric(14,4) not null check (entry_price > 0),
  target_price   numeric(14,4) not null check (target_price > 0),
  stop_price     numeric(14,4) not null check (stop_price > 0),
  horizon        jsonb not null,
  shares         numeric(16,4),
  data_source    text not null,
  bars_used      integer not null,
  paths          integer not null,
  seed           text not null,
  result         jsonb not null,
  created_at     timestamptz not null default now()
);

create index simulation_runs_user_id_created_at_idx on public.simulation_runs (user_id, created_at desc);

alter table public.simulation_runs enable row level security;
revoke all on public.simulation_runs from anon;

create policy "simulation_runs: owner select" on public.simulation_runs
  for select to authenticated using (user_id = auth.uid());

create policy "simulation_runs: owner insert" on public.simulation_runs
  for insert to authenticated with check (user_id = auth.uid());

create policy "simulation_runs: owner delete" on public.simulation_runs
  for delete to authenticated using (user_id = auth.uid());
