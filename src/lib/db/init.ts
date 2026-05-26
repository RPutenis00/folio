import "server-only";
import type Database from "better-sqlite3";

/**
 * Idempotent schema bootstrap — runs on first DB access.
 * Seeds the admin invite from SEED_ADMIN_EMAIL the first time the DB is created.
 */
const DDL = `
create table if not exists profiles (
  id            text primary key,
  email         text not null,
  display_name  text,
  base_currency text not null default 'EUR',
  is_admin      integer not null default 0,
  created_at    integer not null default (unixepoch() * 1000),
  updated_at    integer not null default (unixepoch() * 1000)
);

create table if not exists invited_emails (
  email      text primary key,
  invited_by text references profiles(id) on delete set null,
  note       text,
  created_at integer not null default (unixepoch() * 1000)
);

create table if not exists assets (
  id         text primary key,
  user_id    text not null references profiles(id) on delete cascade,
  category   text not null,
  name       text not null,
  ticker     text,
  currency   text not null default 'EUR',
  status     text not null default 'active',
  metadata   text not null default '{}',
  created_at integer not null default (unixepoch() * 1000),
  updated_at integer not null default (unixepoch() * 1000)
);
create unique index if not exists assets_user_category_ticker_unique
  on assets (user_id, category, lower(ticker)) where ticker is not null;
create index if not exists assets_user_idx     on assets (user_id);
create index if not exists assets_category_idx on assets (user_id, category);

create table if not exists transactions (
  id             text primary key,
  user_id        text not null references profiles(id) on delete cascade,
  asset_id       text not null references assets(id)   on delete cascade,
  type           text not null,
  occurred_at    text not null,
  quantity       text,
  unit_price     text,
  total_amount   text not null,
  fees           text not null default '0',
  currency       text not null,
  fx_rate_to_eur text not null,
  category       text,
  notes          text,
  created_at     integer not null default (unixepoch() * 1000),
  updated_at     integer not null default (unixepoch() * 1000)
);
create index if not exists transactions_asset_date_idx on transactions (asset_id, occurred_at);
create index if not exists transactions_user_date_idx  on transactions (user_id,  occurred_at);
create index if not exists transactions_type_idx       on transactions (type);

create table if not exists properties (
  asset_id           text primary key references assets(id) on delete cascade,
  address_line1      text not null,
  address_line2      text,
  city               text,
  country            text,
  postal_code        text,
  purchase_date      text not null,
  purchase_price     text not null,
  purchase_currency  text not null,
  current_valuation  text not null,
  valuation_date     text not null,
  beds               integer,
  baths              integer,
  sqm                text,
  year_built         integer,
  cover_image_path   text,
  notes              text,
  created_at         integer not null default (unixepoch() * 1000),
  updated_at         integer not null default (unixepoch() * 1000)
);

create table if not exists rental_scenarios (
  id                     text primary key,
  property_id            text not null references properties(asset_id) on delete cascade,
  name                   text not null,
  strategy               text not null,
  is_current             integer not null default 0,
  monthly_rent           text,
  ltr_months_per_year    integer,
  nightly_rate           text,
  occupancy_pct          text,
  cleaning_fee_per_stay  text default '0',
  avg_stay_nights        text,
  platform_fee_pct       text default '0',
  management_fee_pct     text default '0',
  monthly_opex           text not null default '0',
  vacancy_pct            text not null default '0',
  notes                  text,
  created_at             integer not null default (unixepoch() * 1000),
  updated_at             integer not null default (unixepoch() * 1000)
);
create index if not exists rental_scenarios_property_idx
  on rental_scenarios (property_id);
create unique index if not exists rental_scenarios_one_current_per_property
  on rental_scenarios (property_id) where is_current = 1;

create table if not exists price_snapshots (
  symbol      text not null,
  asset_class text not null,
  as_of       text not null,
  price       text not null,
  currency    text not null,
  created_at  integer not null default (unixepoch() * 1000),
  primary key (symbol, asset_class, as_of)
);

create table if not exists holdings_snapshots (
  user_id         text not null references profiles(id) on delete cascade,
  as_of           text not null,
  total_value_eur text not null,
  by_category     text not null,
  created_at      integer not null default (unixepoch() * 1000),
  primary key (user_id, as_of)
);

create table if not exists fx_rates (
  as_of      text not null,
  base       text not null,
  quote      text not null,
  rate       text not null,
  created_at integer not null default (unixepoch() * 1000),
  primary key (as_of, base, quote)
);

create table if not exists attachments (
  id              text primary key,
  user_id         text not null references profiles(id) on delete cascade,
  related_table   text not null,
  related_id      text not null,
  storage_bucket  text not null,
  storage_path    text not null,
  filename        text not null,
  mime_type       text not null,
  size_bytes      integer not null,
  created_at      integer not null default (unixepoch() * 1000)
);
create index if not exists attachments_related_idx on attachments (related_table, related_id);
create index if not exists attachments_user_idx    on attachments (user_id);
`;

let initialized = false;

export function ensureSchema(db: Database.Database): void {
  if (initialized) return;
  db.exec(DDL);

  const seedEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (seedEmail) {
    db.prepare(
      `insert into invited_emails (email, note) values (?, 'Seeded admin') on conflict do nothing`,
    ).run(seedEmail);
    // Promote to admin if they've already signed up.
    db.prepare(`update profiles set is_admin = 1 where lower(email) = ?`).run(seedEmail);
  }

  initialized = true;
}
