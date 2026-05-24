@AGENTS.md

# Folio — Investment Tracker

A private, invite-only portfolio tracker for stocks/ETFs, crypto, and real estate. EUR-denominated. Hosted on Vercel + Supabase free tiers. Built to mirror Anthropic's design language: warm off-white, generous whitespace, serif accents, restrained color.

---

## 1. Source of truth (decisions locked in discovery)

| | |
|---|---|
| **Audience** | Invite-only group. Google OAuth via Supabase. Signup blocked unless email is in `invited_emails`. |
| **MVP categories** | Stocks/ETFs/Index Funds, Crypto, Real Estate (deep-dive). Cash/bonds deferred. |
| **Pricing** | Auto for stocks (Yahoo Finance), crypto (CoinGecko), FX (Frankfurter). Manual for real estate. Adapters behind a `PricingProvider` interface so any one can be swapped. |
| **Base currency** | EUR. Every monetary value stored in its native currency PLUS a snapshot `fx_rate_to_eur` locked at entry time. |
| **Granularity** | Transaction-level for everything. Positions are derived, never stored. |
| **Real estate detail** | Itemized expenses/income with categories. No mortgage amortization in MVP — mortgage payments are logged as plain expenses. |
| **Snapshots** | Daily `price_snapshots` + per-user `holdings_snapshots` via Vercel Cron. Real-estate value carries last manual valuation forward. |
| **Rental model** | `rental_scenarios` table (LTR / STR / Hybrid) with computed metrics; one scenario can be flagged "current". Actual income/expense flows through `transactions`. |
| **Mobile** | Responsive, desktop-first. |
| **Exports** | None for MVP. |
| **Attachments** | Supabase Storage. Photos on properties; receipts on transactions. |

---

## 2. Tech stack (do not swap without good reason)

- **Next.js 15** App Router, React Server Components, Server Actions
- **TypeScript** strict
- **Tailwind CSS v4** with custom design tokens in `src/app/globals.css`
- **shadcn/ui** components (owned in `src/components/ui`, not a dependency)
- **lucide-react** for icons
- **Recharts** for visualizations
- **TanStack Query** (client state cache), **TanStack Table** (data grids)
- **React Hook Form + Zod** for forms (Zod schemas shared with server validation)
- **Drizzle ORM** + `postgres` driver for Supabase Postgres
- **@supabase/ssr** for auth and storage on server/client
- **date-fns** for dates
- **next-themes** for dark mode
- **Vitest** for unit tests

Hosting: **Vercel Hobby** (Next.js + cron). Data: **Supabase Free** (Postgres + Auth + Storage). External price/FX APIs: **CoinGecko**, **Yahoo Finance** (via `yahoo-finance2`), **Frankfurter** — all keyless and free.

---

## 3. Folder structure

```
src/
  app/
    (auth)/login/            # public — sign-in page
    (app)/                   # protected — wrapped in <AppShell>
      page.tsx               # dashboard
      assets/
        page.tsx             # all assets table
        new/page.tsx
        [id]/page.tsx        # asset detail + transactions
      real-estate/
        page.tsx             # property list
        new/page.tsx
        [id]/page.tsx        # property detail
        [id]/scenarios/...
      settings/
        page.tsx
        invites/page.tsx     # admin-only
    api/
      cron/snapshot/route.ts # Vercel cron daily job
    auth/callback/route.ts   # Supabase OAuth return
    layout.tsx
    globals.css
  components/
    ui/                      # shadcn primitives (owned)
    charts/                  # Recharts wrappers
    forms/                   # reusable form fields
    shell/                   # AppShell, Sidebar, TopBar
  lib/
    db/
      schema.ts              # Drizzle schema
      client.ts              # drizzle() instance
      migrations/            # generated SQL + hand-written RLS
    supabase/
      browser.ts             # createBrowserClient
      server.ts              # createServerClient (RSC + Route Handlers)
      middleware.ts
    pricing/
      index.ts               # PricingProvider interface
      yahoo.ts
      coingecko.ts
      frankfurter.ts
    finance/                 # PURE FUNCTIONS — heavily tested
      cost-basis.ts          # FIFO lot matching, avg cost
      yields.ts              # gross/net yield, cash-on-cash, payback
      fx.ts                  # EUR conversion helpers
      portfolio.ts           # rollups
    validators/              # Zod schemas
    constants.ts             # categories, enums
    utils.ts                 # cn(), formatters
  middleware.ts              # Supabase session refresh
tests/
  finance/                   # vitest unit tests
```

---

## 4. Architectural rules

1. **All money values stored as numeric(20,4) in their native currency.** A sibling `fx_rate_to_eur` numeric(20,8) column (snapshotted at write time) lets us recompute EUR totals deterministically. Never store EUR-converted values without keeping the rate.
2. **Positions are derived, not stored.** Computed from `transactions` on read. Cache aggressively with React Query, never persist.
3. **Pure financial functions live in `lib/finance/`.** They must be deterministic, take primitives in / primitives out, and have unit tests. No DB / network access from this folder.
4. **Database access is server-only.** Never import `lib/db/client` or `lib/supabase/server` into a client component. Enforced by `import "server-only"` at the top of those files.
5. **Row-Level Security is the security boundary.** Every table has RLS enabled with policies scoped to `auth.uid()`. Server code uses the anon key with the user's JWT, never the service role key (except in the cron handler).
6. **Server Actions for mutations.** Forms post to Server Actions that validate via Zod and call into `lib/db`. No `/api/*` routes for CRUD — only for webhooks/cron.
7. **One bucket per concern in Storage.** `properties` (photos) and `receipts` (expense docs). RLS policies match the owning row's user.
8. **No optimistic UI in MVP.** Server Action runs, then `revalidatePath`. Keeps state simple.
9. **No global state library.** Server state via TanStack Query, ephemeral UI state via `useState`. URL is the source of truth for filter/sort/page.
10. **Type-safe everywhere.** Zod for input boundaries, Drizzle types for DB, never `any`. ESLint set to error on `no-explicit-any`.

---

## 5. Design tokens (the Anthropic-adjacent feel)

| Token | Light | Dark |
|---|---|---|
| `--background` | `#FAF9F5` | `#1F1E1B` |
| `--surface` | `#FFFFFF` | `#262521` |
| `--surface-muted` | `#F2F0EA` | `#2D2C28` |
| `--border` | `#E8E5DD` | `#3A3833` |
| `--text` | `#1F1E1B` | `#EDEAE0` |
| `--text-muted` | `#75716A` | `#A8A39A` |
| `--accent` | `#C9532D` | `#D86B47` |
| `--success` | `#3F7D58` | `#5DA67E` |
| `--danger` | `#B4422A` | `#D26352` |

- **Body**: Geist Sans, 14–15px
- **Headings**: Instrument Serif (display), Geist Sans for H4+
- **Numbers**: Geist Mono (tabular, for tables and KPIs)
- Border radius: 6px default, 10px for cards, 999px for pills
- Charts: monochrome with single accent — no rainbow palettes

---

## 6. Database schema (full)

All tables have `created_at timestamptz default now()`, `updated_at timestamptz default now()` (trigger), `id uuid primary key default gen_random_uuid()` unless noted.

### `profiles`
Mirrors `auth.users`. Created by trigger on signup.
- `id uuid` (FK → `auth.users.id`, PK)
- `email text not null`
- `display_name text`
- `base_currency text not null default 'EUR'`
- `is_admin boolean not null default false`

### `invited_emails`
- `email text primary key` (lowercased)
- `invited_by uuid` (FK → `profiles.id`)
- `note text`

### `assets`
Polymorphic. Real-estate rows have a matching `properties` row.
- `user_id uuid not null` (FK → `profiles.id`)
- `category text not null` — enum: `stock | etf | fund | crypto | real_estate | cash | bond | other`
- `name text not null` — e.g. "Apple Inc."
- `ticker text` — e.g. "AAPL", "BTC". NULL for real-estate.
- `currency text not null default 'EUR'`
- `status text not null default 'active'` — `active | closed`
- `metadata jsonb not null default '{}'::jsonb`
- Unique: `(user_id, category, lower(ticker))` where ticker not null

### `transactions`
Every money event.
- `user_id uuid not null`
- `asset_id uuid not null` (FK → `assets.id` ON DELETE CASCADE)
- `type text not null` — `buy | sell | dividend | income | expense | valuation | fee | transfer_in | transfer_out`
- `occurred_at date not null`
- `quantity numeric(20,8)` — units for buy/sell, NULL for cash flows
- `unit_price numeric(20,8)` — price per unit for buy/sell, NULL otherwise
- `total_amount numeric(20,4) not null` — gross amount in `currency`
- `fees numeric(20,4) not null default 0`
- `currency text not null`
- `fx_rate_to_eur numeric(20,8) not null` — snapshotted at write time
- `category text` — only for `expense` / `income` on real estate (renovation, repair, mortgage, etc.)
- `notes text`

### `properties`
Real-estate detail (1:1 with `assets` where category = `real_estate`).
- `asset_id uuid primary key` (FK → `assets.id` ON DELETE CASCADE)
- `address_line1 text not null`
- `address_line2 text`
- `city text`
- `country text`
- `postal_code text`
- `purchase_date date not null`
- `purchase_price numeric(20,4) not null`
- `purchase_currency text not null`
- `current_valuation numeric(20,4) not null` — last manual revaluation
- `valuation_date date not null`
- `beds smallint`
- `baths smallint`
- `sqm numeric(10,2)`
- `year_built smallint`
- `cover_image_path text`
- `notes text`

### `rental_scenarios`
- `id uuid pk`
- `property_id uuid not null` (FK → `properties.asset_id` ON DELETE CASCADE)
- `name text not null`
- `strategy text not null` — `LTR | STR | HYBRID`
- `is_current boolean not null default false` — at most one true per property (enforced by partial unique index)
- `monthly_rent numeric(20,4)` — LTR / HYBRID
- `ltr_months_per_year smallint` — HYBRID (rest of year is STR)
- `nightly_rate numeric(20,4)` — STR / HYBRID
- `occupancy_pct numeric(5,2)` — STR / HYBRID (0–100)
- `cleaning_fee_per_stay numeric(20,4) default 0`
- `avg_stay_nights numeric(5,2)` — STR / HYBRID
- `platform_fee_pct numeric(5,2) default 0` — Airbnb/Booking cut
- `management_fee_pct numeric(5,2) default 0`
- `monthly_opex numeric(20,4) not null default 0` — assumed recurring costs
- `vacancy_pct numeric(5,2) not null default 0` — LTR only
- `notes text`

### `price_snapshots`
Shared cache across users — keyed by `(symbol, asset_class, date)`.
- `symbol text not null` — uppercase ticker
- `asset_class text not null` — `equity | crypto`
- `as_of date not null`
- `price numeric(20,8) not null`
- `currency text not null` — native currency of the asset
- PK: `(symbol, asset_class, as_of)`

### `holdings_snapshots`
Per-user daily portfolio rollup.
- `user_id uuid not null`
- `as_of date not null`
- `total_value_eur numeric(20,4) not null`
- `by_category jsonb not null` — `{ stock: 1234.56, crypto: ..., real_estate: ... }`
- PK: `(user_id, as_of)`

### `fx_rates`
- `as_of date not null`
- `base text not null` — usually "EUR"
- `quote text not null`
- `rate numeric(20,8) not null` — quote per 1 base
- PK: `(as_of, base, quote)`

### `attachments`
Polymorphic.
- `user_id uuid not null`
- `related_table text not null` — `transactions | properties`
- `related_id uuid not null`
- `storage_bucket text not null`
- `storage_path text not null`
- `filename text not null`
- `mime_type text not null`
- `size_bytes bigint not null`

---

## 7. RLS approach

- All user-owned tables: `USING (user_id = auth.uid())` + `WITH CHECK (user_id = auth.uid())` for `select / insert / update / delete`.
- `properties` and `rental_scenarios`: policy joins to `assets` via `asset_id` and checks `assets.user_id = auth.uid()`.
- `attachments`: same join logic per `related_table` (subquery into `transactions` / `properties`).
- `invited_emails`: select open to all signed-in users; insert/delete admin-only (`profiles.is_admin = true`).
- `price_snapshots` and `fx_rates`: select open to all signed-in users (shared cache); insert restricted to service role (cron).
- `profiles`: select limited to own row; insert by trigger on signup; update own row, admin can update `is_admin`.

Storage buckets:
- `properties` (private): path = `{user_id}/{property_asset_id}/{filename}`. RLS: user can read/write own folder.
- `receipts` (private): path = `{user_id}/{transaction_id}/{filename}`. RLS: same.

---

## 8. External APIs

| Provider | Use | Notes |
|---|---|---|
| Yahoo Finance via `yahoo-finance2` | Equity quotes (stocks, ETFs, funds) | Unofficial; no key. Wrap in try/catch + fallback to Twelve Data adapter (stub) if it 5xxs. |
| CoinGecko `/simple/price` | Crypto quotes | Public, no key. Use `vs_currencies` matching the asset's currency, else EUR. |
| Frankfurter `https://api.frankfurter.app/{date}?from=X&to=EUR` | FX rates | ECB-sourced, no key. Cached in `fx_rates` table to avoid re-hitting. |

All providers are abstracted behind `PricingProvider`:

```ts
interface PricingProvider {
  fetchPrice(symbol: string, asOf: Date): Promise<{ price: number; currency: string }>;
}
```

---

## 9. Per-phase definition of done

| Phase | DoD |
|---|---|
| **0 Foundations** | `pnpm dev` boots, `/login` renders styled, dark mode toggles, `pnpm build` + `pnpm lint` + `tsc --noEmit` all green. |
| **1 Auth** | Google sign-in returns to `/`, non-invited emails are rejected with a clear message and signed out, `/settings/invites` lists + adds + removes invites (admin only). |
| **2 Schema** | `pnpm db:push` applies migrations to a fresh Supabase project, RLS policy migration applied, seed runs without error. |
| **3 Asset CRUD** | I can add an AAPL holding via 3 buy transactions, see derived position with correct avg cost basis (verified against a hand calc), edit + delete transactions, and FX is auto-fetched for non-EUR. |
| **4 Pricing** | Cron handler can be invoked manually and writes both `price_snapshots` and `holdings_snapshots`. Manual refresh button updates prices on demand. |
| **5 Real estate** | Property created with cover photo upload; expenses + income added with categories; revaluation updates `current_valuation`. |
| **6 Scenarios** | Two scenarios (LTR vs STR) for the same property show computed metrics that match a hand calc; "set as current" flips correctly. |
| **7 Dashboard** | Portfolio total, value-over-time area chart, allocation donut, top-movers — all populated from real data, empty states for new users. |
| **8 Attachments** | Receipts attach to expenses, photos to properties, signed URLs work, RLS denies cross-user access (verified manually). |
| **9 Polish** | `pnpm test` green, Lighthouse perf > 90 on `/`, `/assets`, `/real-estate`. axe-core finds no critical issues on those routes. |
| **10 Deploy** | README walks a new user from zero to deployed in <30 min. |

---

## 10. Coding conventions

- **Server vs client**: default to Server Components. Add `"use client"` only when needed (forms, charts, interactive widgets).
- **Server Actions** live next to the page that uses them in `actions.ts`, or in a feature folder if shared.
- **Filenames**: kebab-case for files, PascalCase for component files. Hooks `use-*.ts`.
- **No barrel files** (`index.ts` re-exports) except for `components/ui` (shadcn convention).
- **Number formatting** goes through `lib/utils.formatCurrency`, never inline `toLocaleString`. Always EUR symbol unless explicitly per-asset currency.
- **Dates** stored as ISO date strings (`YYYY-MM-DD`) for "occurred_at"-style; timestamps as `Date` (ISO). Use `date-fns` exclusively.
- **Forms**: Zod schema first → infer TS type → React Hook Form `useForm<z.infer<typeof schema>>`. Same schema validates on the server.
- **Comments**: minimal. Only for non-obvious "why". Never for "what".

---

## 11. Local dev — quickstart

```bash
pnpm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, CRON_SECRET
pnpm db:push          # apply Drizzle migrations + RLS to your Supabase project
pnpm db:seed          # seed reference data + your admin invite
pnpm dev              # → http://localhost:3000
```

See `README.md` for the full setup including Supabase project creation and Google OAuth configuration.

---

## 12. Things deliberately NOT in MVP (don't drift into these)

- Tax-year capital gains report
- PDF / CSV exports
- Price alerts and email notifications
- Mortgage amortization schedule
- Multi-currency portfolio display (everything rolls to EUR)
- Mobile-first PWA
- Public signup
- Per-asset benchmark comparison
- Brokerage account integrations (Plaid, etc.)

Adding any of these is a v2 conversation.
