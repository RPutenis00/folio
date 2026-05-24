# Folio — Investment Tracker

A private, invite-only portfolio tracker for **stocks/ETFs**, **crypto**, and **real estate**.
EUR-denominated. Hosted on Vercel + Supabase free tiers. Anthropic-inspired design.

> **Stack at a glance:** Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · Drizzle ORM · Supabase (Auth + Postgres + Storage) · Vercel Cron · Recharts. See [`CLAUDE.md`](./CLAUDE.md) for the full architectural rules.

---

## Quickstart (~25 minutes from zero to deployed)

### 1. Clone & install

```bash
git clone <your-repo> folio && cd folio
nvm use            # picks up .nvmrc → Node 22
pnpm install
```

### 2. Create a Supabase project (free)

1. Sign up at <https://supabase.com> and create a new project. Region close to you, EU is fine.
2. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` *(server-only)*
3. From **Project Settings → Database → Connection string → URI**:
   - Use the **Direct connection** URI for migrations → `DATABASE_URL`
   - (Optional) The pooled URI is fine at runtime; we set `prepare: false` either way.

### 3. Configure Google OAuth

1. Go to <https://console.cloud.google.com/apis/credentials>, create an OAuth 2.0 Client (type: Web).
2. **Authorised redirect URI**: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
3. In Supabase → **Authentication → Providers → Google**, paste the Client ID + secret. Enable.
4. In Supabase → **Authentication → URL Configuration**, set the site URL to your prod URL and add `http://localhost:3000` to the redirect list.

### 4. Env vars

```bash
cp .env.example .env.local
# Fill in everything. CRON_SECRET can be any long random string.
# Set SEED_ADMIN_EMAIL to YOUR Google email so the seed script flags you admin.
```

### 5. Apply the schema + RLS + buckets

```bash
pnpm db:push        # Drizzle generates and pushes the tables
pnpm db:policies    # Applies drizzle/policies.sql (RLS, triggers, storage buckets)
pnpm db:seed        # Adds your admin invite to the allowlist
```

If `db:push` ever asks "Do you want to truncate?", say **No** — your data lives in those tables.

### 6. Run it

```bash
pnpm dev
```

Open <http://localhost:3000>, click **Sign in**, and walk through Google. On first sign-in:
- The trigger creates your profile and sets `is_admin = true` (via the seed script).
- You'll land on the dashboard.

---

## Deploying to Vercel

1. Push your repo to GitHub.
2. Import the repo in Vercel. Framework: Next.js (auto-detected).
3. Add the same env vars from `.env.local` in **Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_SITE_URL` (your `https://...vercel.app` or custom domain)
4. Deploy. Vercel will auto-register the cron defined in [`vercel.json`](./vercel.json) — runs nightly at 22:00 UTC.
5. Back in Supabase, update **Authentication → URL Configuration → Site URL** to your prod URL.
6. Update your Google OAuth client to include the prod Supabase callback URL.

That's it. €0/month.

---

## How it works

### Data model
- **`assets`** is polymorphic. Real-estate rows extend via the **`properties`** table (1:1).
- Every money event lives in **`transactions`** — buys, sells, dividends, expenses, income, valuations. *Positions are never stored*, only derived.
- Every transaction snapshots `fx_rate_to_eur` at write time so historic EUR totals are deterministic.
- **`rental_scenarios`** are pure projections — actual income still flows through `transactions`.
- **`price_snapshots`** is a shared cache (one row per symbol per day), populated by the daily cron.

See [`src/lib/db/schema.ts`](./src/lib/db/schema.ts) and [`drizzle/policies.sql`](./drizzle/policies.sql).

### Auth & invite gate
- Google OAuth via `@supabase/ssr` + a Postgres trigger that **rejects signup if the user's email isn't in `invited_emails`**.
- Admins (with `profiles.is_admin = true`) manage the allowlist at `/settings/invites`.

### Pricing
- All three providers (Yahoo Finance for equities, CoinGecko for crypto, Frankfurter for FX) are wrapped in a `PricingProvider` interface in [`src/lib/pricing/`](./src/lib/pricing/) so any one of them is replaceable.
- Daily Vercel cron at [`/api/cron/snapshot`](./src/app/api/cron/snapshot/route.ts) writes both `price_snapshots` and per-user `holdings_snapshots`.
- Manual refresh buttons on each priced asset call the same code path on demand.

### Financial math
Pure functions in [`src/lib/finance/`](./src/lib/finance/):
- `cost-basis.ts` — FIFO lot matching, average cost, realized P&L
- `yields.ts` — gross / net yield, NOI, cash-on-cash, payback (LTR/STR/Hybrid)
- `portfolio.ts` — category roll-ups
- `fx.ts` — EUR conversion

All have Vitest unit tests in [`tests/finance/`](./tests/finance/). Run `pnpm test`.

---

## Commands

```bash
pnpm dev            # local dev server
pnpm build          # production build
pnpm start          # serve the production build

pnpm lint           # ESLint
pnpm format         # Prettier write
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest run-once
pnpm test:watch     # Vitest watch mode

pnpm db:generate    # generate a new SQL migration from schema.ts
pnpm db:push        # push the current schema to Supabase
pnpm db:policies    # apply drizzle/policies.sql (RLS, triggers, storage)
pnpm db:seed        # bootstrap your admin invite
pnpm db:setup       # all three of the above in order
pnpm db:studio      # Drizzle Studio (web UI for Postgres)
```

---

## Folder map

```
src/
  app/
    (auth)/login/           # public — Google sign-in
    auth/callback/          # OAuth return path
    (app)/                  # protected — wrapped in <AppShell>
      dashboard/            # portfolio overview + charts
      assets/               # stocks/ETFs/funds/crypto/cash/bonds
      real-estate/          # property list + detail + scenarios
      settings/invites/     # admin-only allowlist UI
    api/cron/snapshot/      # Vercel cron daily handler
  components/
    ui/                     # shadcn primitives (owned)
    charts/                 # Recharts wrappers
    shell/                  # AppShell, Sidebar, TopBar, MobileNav
  lib/
    db/                     # Drizzle schema + queries + client
    supabase/               # browser + server + middleware clients
    pricing/                # PricingProvider + adapters
    finance/                # pure financial calculations (unit-tested)
    validators/             # Zod schemas (shared with server actions)
    storage/                # Supabase Storage upload helpers
    auth/                   # current-user helpers
drizzle/
  policies.sql              # RLS + triggers + storage buckets
scripts/
  apply-policies.ts         # tsx runner for policies.sql
  seed.ts                   # initial admin invite
tests/
  finance/                  # vitest unit tests
```

---

## What's deliberately NOT in MVP

- Tax-year capital gains report
- PDF / CSV exports
- Price alerts and email notifications
- Mortgage amortization schedule
- Multi-currency portfolio display (everything rolls to EUR)
- Mobile-first PWA
- Public signup
- Brokerage account integrations

Adding any of these is a v2 conversation.

---

## License

Private project. Not for distribution.
