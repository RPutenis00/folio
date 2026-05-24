import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  smallint,
  bigint,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  pgSchema,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ *
 * Supabase's auth schema is opaque to Drizzle — we only need a pointer
 * to `auth.users.id` so we can FK against it.
 * ------------------------------------------------------------------ */
const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

/* ------------------------------------------------------------------ *
 * profiles — 1:1 mirror of auth.users created by trigger on signup.
 * ------------------------------------------------------------------ */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  displayName: text("display_name"),
  baseCurrency: text("base_currency").notNull().default("EUR"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * invited_emails — allowlist gate. Auth callback denies signup if missing.
 * ------------------------------------------------------------------ */
export const invitedEmails = pgTable("invited_emails", {
  email: text("email").primaryKey(),
  invitedBy: uuid("invited_by").references(() => profiles.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * assets — polymorphic. Real-estate rows extend via `properties`.
 * ------------------------------------------------------------------ */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // stock | etf | fund | crypto | real_estate | cash | bond | other
    name: text("name").notNull(),
    ticker: text("ticker"),
    currency: text("currency").notNull().default("EUR"),
    status: text("status").notNull().default("active"), // active | closed
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTickerUnique: uniqueIndex("assets_user_category_ticker_unique")
      .on(t.userId, t.category, sql`lower(${t.ticker})`)
      .where(sql`${t.ticker} is not null`),
    userIdx: index("assets_user_idx").on(t.userId),
    categoryIdx: index("assets_category_idx").on(t.userId, t.category),
  }),
);

/* ------------------------------------------------------------------ *
 * transactions — every money event.
 * ------------------------------------------------------------------ */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // buy | sell | dividend | income | expense | valuation | fee | transfer_in | transfer_out
    occurredAt: date("occurred_at").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 8 }),
    unitPrice: numeric("unit_price", { precision: 20, scale: 8 }),
    totalAmount: numeric("total_amount", { precision: 20, scale: 4 }).notNull(),
    fees: numeric("fees", { precision: 20, scale: 4 }).notNull().default("0"),
    currency: text("currency").notNull(),
    fxRateToEur: numeric("fx_rate_to_eur", { precision: 20, scale: 8 }).notNull(),
    category: text("category"), // real-estate expense/income sub-category
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assetDateIdx: index("transactions_asset_date_idx").on(t.assetId, t.occurredAt),
    userDateIdx: index("transactions_user_date_idx").on(t.userId, t.occurredAt),
    typeIdx: index("transactions_type_idx").on(t.type),
  }),
);

/* ------------------------------------------------------------------ *
 * properties — extends assets where category = 'real_estate'.
 * ------------------------------------------------------------------ */
export const properties = pgTable("properties", {
  assetId: uuid("asset_id")
    .primaryKey()
    .references(() => assets.id, { onDelete: "cascade" }),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city"),
  country: text("country"),
  postalCode: text("postal_code"),
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 20, scale: 4 }).notNull(),
  purchaseCurrency: text("purchase_currency").notNull(),
  currentValuation: numeric("current_valuation", { precision: 20, scale: 4 }).notNull(),
  valuationDate: date("valuation_date").notNull(),
  beds: smallint("beds"),
  baths: smallint("baths"),
  sqm: numeric("sqm", { precision: 10, scale: 2 }),
  yearBuilt: smallint("year_built"),
  coverImagePath: text("cover_image_path"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * rental_scenarios — LTR/STR/HYBRID what-if planner per property.
 * ------------------------------------------------------------------ */
export const rentalScenarios = pgTable(
  "rental_scenarios",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.assetId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    strategy: text("strategy").notNull(), // LTR | STR | HYBRID
    isCurrent: boolean("is_current").notNull().default(false),
    monthlyRent: numeric("monthly_rent", { precision: 20, scale: 4 }),
    ltrMonthsPerYear: smallint("ltr_months_per_year"),
    nightlyRate: numeric("nightly_rate", { precision: 20, scale: 4 }),
    occupancyPct: numeric("occupancy_pct", { precision: 5, scale: 2 }),
    cleaningFeePerStay: numeric("cleaning_fee_per_stay", { precision: 20, scale: 4 }).default("0"),
    avgStayNights: numeric("avg_stay_nights", { precision: 5, scale: 2 }),
    platformFeePct: numeric("platform_fee_pct", { precision: 5, scale: 2 }).default("0"),
    managementFeePct: numeric("management_fee_pct", { precision: 5, scale: 2 }).default("0"),
    monthlyOpex: numeric("monthly_opex", { precision: 20, scale: 4 }).notNull().default("0"),
    vacancyPct: numeric("vacancy_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    propertyIdx: index("rental_scenarios_property_idx").on(t.propertyId),
    onlyOneCurrentPerProperty: uniqueIndex("rental_scenarios_one_current_per_property")
      .on(t.propertyId)
      .where(sql`${t.isCurrent} = true`),
  }),
);

/* ------------------------------------------------------------------ *
 * price_snapshots — shared cache, populated by daily cron.
 * ------------------------------------------------------------------ */
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    symbol: text("symbol").notNull(),
    assetClass: text("asset_class").notNull(), // equity | crypto
    asOf: date("as_of").notNull(),
    price: numeric("price", { precision: 20, scale: 8 }).notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.symbol, t.assetClass, t.asOf] }),
  }),
);

/* ------------------------------------------------------------------ *
 * holdings_snapshots — per-user daily portfolio rollup.
 * ------------------------------------------------------------------ */
export const holdingsSnapshots = pgTable(
  "holdings_snapshots",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    asOf: date("as_of").notNull(),
    totalValueEur: numeric("total_value_eur", { precision: 20, scale: 4 }).notNull(),
    byCategory: jsonb("by_category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.asOf] }),
  }),
);

/* ------------------------------------------------------------------ *
 * fx_rates — keyless rates from Frankfurter, cached.
 * ------------------------------------------------------------------ */
export const fxRates = pgTable(
  "fx_rates",
  {
    asOf: date("as_of").notNull(),
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    rate: numeric("rate", { precision: 20, scale: 8 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.asOf, t.base, t.quote] }),
  }),
);

/* ------------------------------------------------------------------ *
 * attachments — polymorphic file pointers in Supabase Storage.
 * ------------------------------------------------------------------ */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    relatedTable: text("related_table").notNull(), // transactions | properties
    relatedId: uuid("related_id").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    relatedIdx: index("attachments_related_idx").on(t.relatedTable, t.relatedId),
    userIdx: index("attachments_user_idx").on(t.userId),
  }),
);

/* Inferred TS types */
export type Profile = typeof profiles.$inferSelect;
export type InvitedEmail = typeof invitedEmails.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type RentalScenario = typeof rentalScenarios.$inferSelect;
export type NewRentalScenario = typeof rentalScenarios.$inferInsert;
export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type HoldingsSnapshot = typeof holdingsSnapshots.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
