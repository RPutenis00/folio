import "server-only";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import { getPrice, fetchEurFxRate } from "@/lib/pricing";

export const runtime = "nodejs";
// Vercel cron triggers — handler must complete inside the function timeout.
export const maxDuration = 60;

/**
 * Daily cron handler.
 *
 * Steps:
 *   1. Find every (symbol, asset_class) pair held by any user.
 *   2. Fetch latest price → upsert into price_snapshots (shared cache).
 *   3. Recompute per-user portfolio rollup → upsert into holdings_snapshots.
 *
 * Secured by the `CRON_SECRET` env var. Vercel cron sends an
 * `Authorization: Bearer <secret>` header.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // ----- Step 1: collect unique tickers --------------------------------
  const tickers = await db
    .select({ ticker: schema.assets.ticker, category: schema.assets.category })
    .from(schema.assets)
    .where(sql`${schema.assets.ticker} is not null`);

  const seen = new Set<string>();
  const symbols: Array<{ symbol: string; assetClass: "equity" | "crypto" }> = [];
  for (const t of tickers) {
    if (!t.ticker) continue;
    const klass: "equity" | "crypto" = t.category === "crypto" ? "crypto" : "equity";
    const key = `${t.ticker.toUpperCase()}|${klass}`;
    if (seen.has(key)) continue;
    seen.add(key);
    symbols.push({ symbol: t.ticker, assetClass: klass });
  }

  // ----- Step 2: fetch + upsert price snapshots -------------------------
  const priced: Array<{ symbol: string; assetClass: string; ok: boolean; error?: string }> = [];
  for (const s of symbols) {
    try {
      const q = await getPrice(s.symbol, s.assetClass);
      await db
        .insert(schema.priceSnapshots)
        .values({
          symbol: s.symbol.toUpperCase(),
          assetClass: s.assetClass,
          asOf: todayStr,
          price: String(q.price),
          currency: q.currency,
        })
        .onConflictDoUpdate({
          target: [
            schema.priceSnapshots.symbol,
            schema.priceSnapshots.assetClass,
            schema.priceSnapshots.asOf,
          ],
          set: { price: String(q.price), currency: q.currency },
        });
      priced.push({ symbol: s.symbol, assetClass: s.assetClass, ok: true });
    } catch (e) {
      priced.push({
        symbol: s.symbol,
        assetClass: s.assetClass,
        ok: false,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  // ----- Step 3: refresh EUR FX rates for every non-EUR currency used ---
  const currencies = await db
    .selectDistinct({ currency: schema.priceSnapshots.currency })
    .from(schema.priceSnapshots);
  for (const c of currencies) {
    if (!c.currency || c.currency === "EUR") continue;
    try {
      const rate = await fetchEurFxRate(c.currency, new Date());
      await db
        .insert(schema.fxRates)
        .values({
          asOf: todayStr,
          base: c.currency,
          quote: "EUR",
          rate: String(rate),
        })
        .onConflictDoUpdate({
          target: [schema.fxRates.asOf, schema.fxRates.base, schema.fxRates.quote],
          set: { rate: String(rate) },
        });
    } catch {
      // best-effort
    }
  }

  // ----- Step 4: per-user holdings rollup -------------------------------
  // We need the service-role db (already in use) to compute across all users.
  const users = await db
    .selectDistinct({ userId: schema.profiles.id })
    .from(schema.profiles);

  let rolledUp = 0;
  for (const u of users) {
    try {
      // Lazy import to avoid pulling DOM-heavy code into edge.
      const { getPortfolio } = await import("@/lib/db/queries");
      const portfolio = await getPortfolio(u.userId);
      await db
        .insert(schema.holdingsSnapshots)
        .values({
          userId: u.userId,
          asOf: todayStr,
          totalValueEur: String(portfolio.rollup.totalValueEur),
          byCategory: portfolio.rollup.byCategory,
        })
        .onConflictDoUpdate({
          target: [schema.holdingsSnapshots.userId, schema.holdingsSnapshots.asOf],
          set: {
            totalValueEur: String(portfolio.rollup.totalValueEur),
            byCategory: portfolio.rollup.byCategory,
          },
        });
      rolledUp += 1;
    } catch {
      // continue with other users
    }
  }

  return NextResponse.json({
    ok: true,
    asOf: todayStr,
    pricedCount: priced.filter((p) => p.ok).length,
    failedCount: priced.filter((p) => !p.ok).length,
    failed: priced.filter((p) => !p.ok),
    usersRolledUp: rolledUp,
  });
}
