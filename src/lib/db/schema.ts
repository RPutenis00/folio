import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/**
 * Folio — SQLite schema (runs in-process via better-sqlite3, no containers).
 *
 * Conventions:
 *   - IDs are TEXT, generated client-side via crypto.randomUUID().
 *   - Money / quantity columns are TEXT to preserve decimal precision
 *     (better-sqlite3's REAL is a JS number = lossy for finance).
 *   - Timestamps are stored as INTEGER unix-ms.
 *   - Booleans are INTEGER 0/1 via Drizzle's mode: "boolean".
 *   - JSON blobs are TEXT (parsed/stringified at app layer).
 */

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  baseCurrency: text("base_currency").notNull().default("EUR"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const invitedEmails = sqliteTable("invited_emails", {
  email: text("email").primaryKey(),
  invitedBy: text("invited_by").references(() => profiles.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    name: text("name").notNull(),
    ticker: text("ticker"),
    currency: text("currency").notNull().default("EUR"),
    status: text("status").notNull().default("active"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userTickerUnique: uniqueIndex("assets_user_category_ticker_unique")
      .on(t.userId, t.category, sql`lower(${t.ticker})`)
      .where(sql`${t.ticker} is not null`),
    userIdx: index("assets_user_idx").on(t.userId),
    categoryIdx: index("assets_category_idx").on(t.userId, t.category),
  }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    occurredAt: text("occurred_at").notNull(), // YYYY-MM-DD
    quantity: text("quantity"),
    unitPrice: text("unit_price"),
    totalAmount: text("total_amount").notNull(),
    fees: text("fees").notNull().default("0"),
    currency: text("currency").notNull(),
    fxRateToEur: text("fx_rate_to_eur").notNull(),
    category: text("category"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    assetDateIdx: index("transactions_asset_date_idx").on(t.assetId, t.occurredAt),
    userDateIdx: index("transactions_user_date_idx").on(t.userId, t.occurredAt),
    typeIdx: index("transactions_type_idx").on(t.type),
  }),
);

export const properties = sqliteTable("properties", {
  assetId: text("asset_id")
    .primaryKey()
    .references(() => assets.id, { onDelete: "cascade" }),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city"),
  country: text("country"),
  postalCode: text("postal_code"),
  purchaseDate: text("purchase_date").notNull(),
  purchasePrice: text("purchase_price").notNull(),
  purchaseCurrency: text("purchase_currency").notNull(),
  currentValuation: text("current_valuation").notNull(),
  valuationDate: text("valuation_date").notNull(),
  beds: integer("beds"),
  baths: integer("baths"),
  sqm: text("sqm"),
  yearBuilt: integer("year_built"),
  coverImagePath: text("cover_image_path"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const rentalScenarios = sqliteTable(
  "rental_scenarios",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.assetId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    strategy: text("strategy").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
    monthlyRent: text("monthly_rent"),
    ltrMonthsPerYear: integer("ltr_months_per_year"),
    nightlyRate: text("nightly_rate"),
    occupancyPct: text("occupancy_pct"),
    cleaningFeePerStay: text("cleaning_fee_per_stay").default("0"),
    avgStayNights: text("avg_stay_nights"),
    platformFeePct: text("platform_fee_pct").default("0"),
    managementFeePct: text("management_fee_pct").default("0"),
    monthlyOpex: text("monthly_opex").notNull().default("0"),
    vacancyPct: text("vacancy_pct").notNull().default("0"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    propertyIdx: index("rental_scenarios_property_idx").on(t.propertyId),
    onlyOneCurrentPerProperty: uniqueIndex("rental_scenarios_one_current_per_property")
      .on(t.propertyId)
      .where(sql`${t.isCurrent} = 1`),
  }),
);

export const priceSnapshots = sqliteTable(
  "price_snapshots",
  {
    symbol: text("symbol").notNull(),
    assetClass: text("asset_class").notNull(),
    asOf: text("as_of").notNull(),
    price: text("price").notNull(),
    currency: text("currency").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.symbol, t.assetClass, t.asOf] }),
  }),
);

export const holdingsSnapshots = sqliteTable(
  "holdings_snapshots",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    asOf: text("as_of").notNull(),
    totalValueEur: text("total_value_eur").notNull(),
    byCategory: text("by_category").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.asOf] }),
  }),
);

export const fxRates = sqliteTable(
  "fx_rates",
  {
    asOf: text("as_of").notNull(),
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    rate: text("rate").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.asOf, t.base, t.quote] }),
  }),
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    relatedTable: text("related_table").notNull(),
    relatedId: text("related_id").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
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
