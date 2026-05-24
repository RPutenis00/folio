-- =============================================================
-- Folio — schema bootstrap (hand-written from src/lib/db/schema.ts).
-- Apply with: pnpm db:apply (psql), then pnpm db:policies for RLS.
-- Idempotent: every object uses IF NOT EXISTS or CREATE OR REPLACE.
-- =============================================================

create extension if not exists "pgcrypto";

-- ----- profiles ----------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  base_currency text not null default 'EUR',
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----- invited_emails ----------------------------------------------
create table if not exists public.invited_emails (
  email       text primary key,
  invited_by  uuid references public.profiles(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

-- ----- assets -------------------------------------------------------
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category    text not null,
  name        text not null,
  ticker      text,
  currency    text not null default 'EUR',
  status      text not null default 'active',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists assets_user_category_ticker_unique
  on public.assets (user_id, category, lower(ticker)) where ticker is not null;
create index if not exists assets_user_idx     on public.assets (user_id);
create index if not exists assets_category_idx on public.assets (user_id, category);

-- ----- transactions -------------------------------------------------
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  asset_id        uuid not null references public.assets(id) on delete cascade,
  type            text not null,
  occurred_at     date not null,
  quantity        numeric(20,8),
  unit_price      numeric(20,8),
  total_amount    numeric(20,4) not null,
  fees            numeric(20,4) not null default 0,
  currency        text not null,
  fx_rate_to_eur  numeric(20,8) not null,
  category        text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists transactions_asset_date_idx on public.transactions (asset_id, occurred_at);
create index if not exists transactions_user_date_idx  on public.transactions (user_id,  occurred_at);
create index if not exists transactions_type_idx       on public.transactions (type);

-- ----- properties ---------------------------------------------------
create table if not exists public.properties (
  asset_id           uuid primary key references public.assets(id) on delete cascade,
  address_line1      text not null,
  address_line2      text,
  city               text,
  country            text,
  postal_code        text,
  purchase_date      date not null,
  purchase_price     numeric(20,4) not null,
  purchase_currency  text not null,
  current_valuation  numeric(20,4) not null,
  valuation_date     date not null,
  beds               smallint,
  baths              smallint,
  sqm                numeric(10,2),
  year_built         smallint,
  cover_image_path   text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ----- rental_scenarios --------------------------------------------
create table if not exists public.rental_scenarios (
  id                     uuid primary key default gen_random_uuid(),
  property_id            uuid not null references public.properties(asset_id) on delete cascade,
  name                   text not null,
  strategy               text not null,
  is_current             boolean not null default false,
  monthly_rent           numeric(20,4),
  ltr_months_per_year    smallint,
  nightly_rate           numeric(20,4),
  occupancy_pct          numeric(5,2),
  cleaning_fee_per_stay  numeric(20,4) default 0,
  avg_stay_nights        numeric(5,2),
  platform_fee_pct       numeric(5,2) default 0,
  management_fee_pct     numeric(5,2) default 0,
  monthly_opex           numeric(20,4) not null default 0,
  vacancy_pct            numeric(5,2) not null default 0,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists rental_scenarios_property_idx
  on public.rental_scenarios (property_id);
create unique index if not exists rental_scenarios_one_current_per_property
  on public.rental_scenarios (property_id) where is_current = true;

-- ----- price_snapshots ---------------------------------------------
create table if not exists public.price_snapshots (
  symbol      text not null,
  asset_class text not null,
  as_of       date not null,
  price       numeric(20,8) not null,
  currency    text not null,
  created_at  timestamptz not null default now(),
  primary key (symbol, asset_class, as_of)
);

-- ----- holdings_snapshots ------------------------------------------
create table if not exists public.holdings_snapshots (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  as_of           date not null,
  total_value_eur numeric(20,4) not null,
  by_category     jsonb not null,
  created_at      timestamptz not null default now(),
  primary key (user_id, as_of)
);

-- ----- fx_rates -----------------------------------------------------
create table if not exists public.fx_rates (
  as_of       date not null,
  base        text not null,
  quote       text not null,
  rate        numeric(20,8) not null,
  created_at  timestamptz not null default now(),
  primary key (as_of, base, quote)
);

-- ----- attachments --------------------------------------------------
create table if not exists public.attachments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  related_table   text not null,
  related_id      uuid not null,
  storage_bucket  text not null,
  storage_path    text not null,
  filename        text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  created_at      timestamptz not null default now()
);
create index if not exists attachments_related_idx on public.attachments (related_table, related_id);
create index if not exists attachments_user_idx    on public.attachments (user_id);
