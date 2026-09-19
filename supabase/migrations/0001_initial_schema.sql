-- Watchlist: initial schema
-- See DATABASE.md for the full description of every table and column.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.trade_status as enum ('planned', 'open', 'closed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- watchlists
-- ---------------------------------------------------------------------------
create table public.watchlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index watchlists_user_id_position_idx on public.watchlists (user_id, position);

create trigger watchlists_set_updated_at
  before update on public.watchlists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- watchlist_items
-- ---------------------------------------------------------------------------
create table public.watchlist_items (
  id            uuid primary key default gen_random_uuid(),
  watchlist_id  uuid not null references public.watchlists (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  ticker        text not null check (ticker = upper(ticker) and char_length(ticker) between 1 and 10),
  company_name  text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (watchlist_id, ticker)
);

create index watchlist_items_watchlist_id_position_idx on public.watchlist_items (watchlist_id, position);
create index watchlist_items_user_id_idx on public.watchlist_items (user_id);

-- A user may only add items to watchlists they own, even if user_id matches.
create or replace function public.enforce_watchlist_item_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.watchlists where id = new.watchlist_id;
  if owner is null or owner <> new.user_id then
    raise exception 'watchlist_items.user_id must match the owner of the watchlist';
  end if;
  return new;
end;
$$;

create trigger watchlist_items_enforce_owner
  before insert or update on public.watchlist_items
  for each row execute function public.enforce_watchlist_item_owner();

-- ---------------------------------------------------------------------------
-- trade_scenarios
-- ---------------------------------------------------------------------------
create table public.trade_scenarios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  ticker        text not null check (char_length(ticker) between 1 and 10),
  entry_price   numeric(14,4) not null check (entry_price > 0),
  capital       numeric(14,2) not null check (capital > 0),
  shares        numeric(16,4) not null check (shares > 0),
  target_price  numeric(14,4) check (target_price is null or target_price > 0),
  stop_price    numeric(14,4) check (stop_price is null or stop_price > 0),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index trade_scenarios_user_id_created_at_idx on public.trade_scenarios (user_id, created_at desc);

create trigger trade_scenarios_set_updated_at
  before update on public.trade_scenarios
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trades
-- ---------------------------------------------------------------------------
create table public.trades (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  ticker         text not null check (char_length(ticker) between 1 and 10),
  company_name   text,
  status         public.trade_status not null default 'planned',
  entry_price    numeric(14,4) check (entry_price is null or entry_price > 0),
  entry_date     date,
  entry_time     time,
  shares         numeric(16,4) check (shares is null or shares > 0),
  capital        numeric(14,2) check (capital is null or capital >= 0),
  target_price   numeric(14,4) check (target_price is null or target_price > 0),
  stop_price     numeric(14,4) check (stop_price is null or stop_price > 0),
  exit_price     numeric(14,4) check (exit_price is null or exit_price >= 0),
  exit_date      date,
  exit_time      time,
  notes          text,
  entry_reason   text,
  reflection     text,
  followed_plan  boolean,
  improvement    text,
  scenario_id    uuid references public.trade_scenarios (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A closed trade must have the numbers needed to compute realized P/L.
  constraint trades_closed_requires_exit check (
    status <> 'closed' or (exit_price is not null and entry_price is not null and shares is not null)
  ),
  -- An open trade must have an entry.
  constraint trades_open_requires_entry check (
    status <> 'open' or (entry_price is not null and shares is not null)
  )
);

create index trades_user_id_status_idx on public.trades (user_id, status);
create index trades_user_id_entry_date_idx on public.trades (user_id, entry_date desc);

create trigger trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile row + a default watchlist
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));

  insert into public.watchlists (user_id, name, position)
  values (new.id, 'Watchlist', 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
