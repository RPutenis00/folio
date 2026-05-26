import "server-only";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getPrice, fetchEurFxRate } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * POST /api/prices/refresh
 * Body: { tickers?: string[] }   // optional — defaults to all of the caller's priced assets
 *
 * For each ticker:
 *   - fetch live price (Yahoo for equities, CoinGecko for crypto)
 *   - upsert into price_snapshots
 *   - refresh the FX rate against EUR for the price's currency
 *
 * Returns the refreshed quotes + any errors so the UI can render a summary.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { tickers?: string[] };
  const requested = body.tickers?.map((t) => t.toUpperCase().trim()).filter(Boolean);

  const rows = await db
    .select({ ticker: schema.assets.ticker, category: schema.assets.category })
    .from(schema.assets)
    .where(
      sql`${schema.assets.userId} = ${profile.id}
          and ${schema.assets.ticker} is not null
          and ${schema.assets.category} in ('stock','etf','fund','crypto')`,
    );

  const seen = new Set<string>();
  const symbols: Array<{ symbol: string; assetClass: "equity" | "crypto" }> = [];
  for (const r of rows) {
    if (!r.ticker) continue;
    if (requested && !requested.includes(r.ticker.toUpperCase())) continue;
    const klass: "equity" | "crypto" = r.category === "crypto" ? "crypto" : "equity";
    const key = `${r.ticker.toUpperCase()}|${klass}`;
    if (seen.has(key)) continue;
    seen.add(key);
    symbols.push({ symbol: r.ticker, assetClass: klass });
  }

  const today = new Date().toISOString().slice(0, 10);
  const refreshed: Array<{ symbol: string; assetClass: string; price: number; currency: string }> = [];
  const failed: Array<{ symbol: string; error: string }> = [];
  const currenciesSeen = new Set<string>();

  for (const s of symbols) {
    try {
      const q = await getPrice(s.symbol, s.assetClass);
      currenciesSeen.add(q.currency);
      await db
        .insert(schema.priceSnapshots)
        .values({
          symbol: s.symbol.toUpperCase(),
          assetClass: s.assetClass,
          asOf: today,
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
      refreshed.push({
        symbol: s.symbol.toUpperCase(),
        assetClass: s.assetClass,
        price: q.price,
        currency: q.currency,
      });
    } catch (e) {
      failed.push({
        symbol: s.symbol,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  // Refresh FX rates for every currency we saw (except EUR itself).
  for (const cur of currenciesSeen) {
    if (cur === "EUR") continue;
    try {
      const rate = await fetchEurFxRate(cur);
      await db
        .insert(schema.fxRates)
        .values({ asOf: today, base: cur, quote: "EUR", rate: String(rate) })
        .onConflictDoUpdate({
          target: [schema.fxRates.asOf, schema.fxRates.base, schema.fxRates.quote],
          set: { rate: String(rate) },
        });
    } catch {
      // best effort
    }
  }

  return NextResponse.json({
    ok: true,
    asOf: today,
    refreshed,
    failed,
    count: refreshed.length,
  });
}
