import "server-only";
import { db, schema } from "./client";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { deriveLots, marketValue, unrealizedPnl, type Tx } from "@/lib/finance/cost-basis";
import { rollupPortfolio } from "@/lib/finance/portfolio";
import type { AssetCategory } from "@/lib/constants";

/* ------------------------------------------------------------------ *
 * Helpers — turn numeric strings from Postgres into JS numbers safely.
 * ------------------------------------------------------------------ */
const num = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

function toTx(t: schema.Transaction): Tx {
  return {
    type: t.type as Tx["type"],
    quantity: t.quantity != null ? num(t.quantity) : null,
    unitPrice: t.unitPrice != null ? num(t.unitPrice) : null,
    totalAmount: num(t.totalAmount),
    fees: num(t.fees),
    fxRateToEur: num(t.fxRateToEur),
    occurredAt: t.occurredAt,
  };
}

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */
export async function listUserAssets(userId: string) {
  return db
    .select()
    .from(schema.assets)
    .where(eq(schema.assets.userId, userId))
    .orderBy(asc(schema.assets.name));
}

export async function getAsset(userId: string, assetId: string) {
  const [row] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, userId), eq(schema.assets.id, assetId)))
    .limit(1);
  return row ?? null;
}

export async function listAssetTransactions(userId: string, assetId: string) {
  return db
    .select()
    .from(schema.transactions)
    .where(
      and(eq(schema.transactions.userId, userId), eq(schema.transactions.assetId, assetId)),
    )
    .orderBy(desc(schema.transactions.occurredAt));
}

/* ------------------------------------------------------------------ *
 * Latest prices — pulled from price_snapshots cache, keyed by symbol.
 * ------------------------------------------------------------------ */
export async function latestPricesForSymbols(
  symbols: { symbol: string; assetClass: "equity" | "crypto" }[],
) {
  if (symbols.length === 0) return new Map<string, { price: number; currency: string }>();
  const upper = symbols.map((s) => s.symbol.toUpperCase());
  const rows = await db
    .select()
    .from(schema.priceSnapshots)
    .where(inArray(schema.priceSnapshots.symbol, upper))
    .orderBy(desc(schema.priceSnapshots.asOf));

  const map = new Map<string, { price: number; currency: string }>();
  for (const row of rows) {
    const key = row.symbol.toUpperCase();
    if (!map.has(key)) {
      map.set(key, { price: num(row.price), currency: row.currency });
    }
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Derived position + valuation for a single asset.
 * ------------------------------------------------------------------ */
export type AssetWithPosition = {
  asset: schema.Asset;
  txs: schema.Transaction[];
  position: ReturnType<typeof deriveLots>;
  marketPrice?: { price: number; currency: string };
  marketValueEur: number;
  unrealizedPnlEur: number;
  costBasisEur: number;
};

export async function getAssetWithPosition(
  userId: string,
  assetId: string,
): Promise<AssetWithPosition | null> {
  const asset = await getAsset(userId, assetId);
  if (!asset) return null;

  const txs = await listAssetTransactions(userId, assetId);
  const position = deriveLots(txs.map(toTx));

  let marketPrice: { price: number; currency: string } | undefined;
  let marketValueEur = 0;
  let unrealizedPnlEur = 0;

  if (asset.ticker && (asset.category === "stock" || asset.category === "etf" || asset.category === "fund" || asset.category === "crypto")) {
    const assetClass: "equity" | "crypto" = asset.category === "crypto" ? "crypto" : "equity";
    const prices = await latestPricesForSymbols([{ symbol: asset.ticker, assetClass }]);
    marketPrice = prices.get(asset.ticker.toUpperCase());
    if (marketPrice) {
      // Convert latest price to EUR using the latest fx rate (if any) — for
      // perfect accuracy this should use the freshest fx_rate, but we re-use
      // the rate from the latest tx as a fallback.
      const latestFx = txs[0]?.fxRateToEur ? num(txs[0].fxRateToEur) : 1;
      const priceEur =
        marketPrice.currency === "EUR" ? marketPrice.price : marketPrice.price * latestFx;
      marketValueEur = marketValue(position, priceEur);
      unrealizedPnlEur = unrealizedPnl(position, priceEur);
    }
  }

  return {
    asset,
    txs,
    position,
    marketPrice,
    marketValueEur,
    unrealizedPnlEur,
    costBasisEur: position.totalCostEur,
  };
}

/* ------------------------------------------------------------------ *
 * Portfolio roll-up across all of a user's assets.
 * Real estate → current_valuation. Cash/bonds → total net flow.
 * ------------------------------------------------------------------ */
export async function getPortfolio(userId: string) {
  const assets = await listUserAssets(userId);

  const assetIds = assets.map((a) => a.id);
  if (assetIds.length === 0) {
    return {
      assets: [],
      rollup: rollupPortfolio([]),
      totalUnrealizedPnlEur: 0,
      totalDividendsEur: 0,
    };
  }

  const txs = await db
    .select()
    .from(schema.transactions)
    .where(
      and(eq(schema.transactions.userId, userId), inArray(schema.transactions.assetId, assetIds)),
    );

  const txsByAsset = new Map<string, schema.Transaction[]>();
  for (const t of txs) {
    const list = txsByAsset.get(t.assetId) ?? [];
    list.push(t);
    txsByAsset.set(t.assetId, list);
  }

  // Properties join — for real-estate market value.
  const properties = await db.select().from(schema.properties);
  const propMap = new Map(properties.map((p) => [p.assetId, p]));

  // Latest equity/crypto prices, batched.
  const pricedSymbols = assets
    .filter(
      (a) =>
        a.ticker &&
        (a.category === "stock" || a.category === "etf" || a.category === "fund" || a.category === "crypto"),
    )
    .map((a) => ({
      symbol: a.ticker as string,
      assetClass: (a.category === "crypto" ? "crypto" : "equity") as "equity" | "crypto",
    }));
  const priceMap = await latestPricesForSymbols(pricedSymbols);

  const valuations = [] as Array<{
    asset: schema.Asset;
    category: AssetCategory;
    marketValueEur: number;
    costBasisEur: number;
    unrealizedPnlEur: number;
    totalDividendsEur: number;
    currentQuantity: number;
  }>;

  for (const asset of assets) {
    const myTxs = (txsByAsset.get(asset.id) ?? []).map(toTx);
    const pos = deriveLots(myTxs);
    let mv = 0;

    if (asset.category === "real_estate") {
      const prop = propMap.get(asset.id);
      if (prop) {
        const lastFx = txsByAsset.get(asset.id)?.at(-1)?.fxRateToEur;
        const fx = lastFx != null ? num(lastFx) : 1;
        mv = num(prop.currentValuation) * (prop.purchaseCurrency === "EUR" ? 1 : fx);
      }
    } else if (asset.ticker && priceMap.has(asset.ticker.toUpperCase())) {
      const p = priceMap.get(asset.ticker.toUpperCase())!;
      const lastFx = (txsByAsset.get(asset.id) ?? [])[0]?.fxRateToEur;
      const fx = lastFx != null ? num(lastFx) : 1;
      const priceEur = p.currency === "EUR" ? p.price : p.price * fx;
      mv = marketValue(pos, priceEur);
    } else {
      // Unpriced (cash/bond/other) → use cost basis as MV proxy.
      mv = pos.totalCostEur;
    }

    valuations.push({
      asset,
      category: asset.category as AssetCategory,
      marketValueEur: mv,
      costBasisEur: pos.totalCostEur,
      unrealizedPnlEur: mv - pos.totalCostEur,
      totalDividendsEur: pos.totalDividendsEur,
      currentQuantity: pos.currentQuantity,
    });
  }

  const rollup = rollupPortfolio(
    valuations.map((v) => ({
      assetId: v.asset.id,
      category: v.category,
      marketValueEur: v.marketValueEur,
      costBasisEur: v.costBasisEur,
    })),
  );

  const totalDividendsEur = valuations.reduce((s, v) => s + v.totalDividendsEur, 0);

  return {
    assets: valuations,
    rollup,
    totalUnrealizedPnlEur: rollup.unrealizedPnlEur,
    totalDividendsEur,
  };
}

/* ------------------------------------------------------------------ *
 * Properties + scenarios
 * ------------------------------------------------------------------ */
export async function listUserProperties(userId: string) {
  return db
    .select({
      asset: schema.assets,
      property: schema.properties,
    })
    .from(schema.assets)
    .innerJoin(schema.properties, eq(schema.properties.assetId, schema.assets.id))
    .where(and(eq(schema.assets.userId, userId), eq(schema.assets.category, "real_estate")))
    .orderBy(asc(schema.assets.name));
}

export async function getProperty(userId: string, assetId: string) {
  const [row] = await db
    .select({ asset: schema.assets, property: schema.properties })
    .from(schema.assets)
    .innerJoin(schema.properties, eq(schema.properties.assetId, schema.assets.id))
    .where(and(eq(schema.assets.userId, userId), eq(schema.assets.id, assetId)))
    .limit(1);
  return row ?? null;
}

export async function listScenarios(propertyId: string) {
  return db
    .select()
    .from(schema.rentalScenarios)
    .where(eq(schema.rentalScenarios.propertyId, propertyId))
    .orderBy(desc(schema.rentalScenarios.isCurrent), asc(schema.rentalScenarios.name));
}

/* ------------------------------------------------------------------ *
 * Holdings snapshots — for value-over-time charts.
 * ------------------------------------------------------------------ */
export async function listHoldingsSnapshots(userId: string, days = 365) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return db
    .select()
    .from(schema.holdingsSnapshots)
    .where(
      and(
        eq(schema.holdingsSnapshots.userId, userId),
        sql`${schema.holdingsSnapshots.asOf} >= ${cutoffStr}`,
      ),
    )
    .orderBy(asc(schema.holdingsSnapshots.asOf));
}
