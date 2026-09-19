-- Watchlist: recorded price ticks
--
-- The app records the quotes it fetches so that market-data plans without history
-- (e.g. Finnhub free) still build up real intraday history for the sparklines and
-- the 1H / 1D ranges. Prices are public market data shared by every user.

create table public.price_ticks (
  symbol  text not null check (symbol = upper(symbol) and char_length(symbol) between 1 and 10),
  t       timestamptz not null,
  price   numeric(14,4) not null check (price > 0),
  primary key (symbol, t)
);

create index price_ticks_symbol_t_idx on public.price_ticks (symbol, t desc);

alter table public.price_ticks enable row level security;
revoke all on public.price_ticks from anon;

-- Any signed-in user may read shared price history.
create policy "price_ticks: authenticated select" on public.price_ticks
  for select to authenticated using (true);

-- Signed-in users may append ticks (the server does this while serving quotes).
-- Timestamps must be recent so stale or future history cannot be injected.
create policy "price_ticks: authenticated insert" on public.price_ticks
  for insert to authenticated
  with check (t <= now() + interval '1 minute' and t >= now() - interval '10 minutes');

-- Keep the table small: drop ticks older than 400 days when new ones arrive (cheap, index-backed).
create or replace function public.prune_price_ticks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if random() < 0.01 then
    delete from public.price_ticks where t < now() - interval '400 days';
  end if;
  return null;
end;
$$;

create trigger price_ticks_prune
  after insert on public.price_ticks
  for each statement execute function public.prune_price_ticks();
