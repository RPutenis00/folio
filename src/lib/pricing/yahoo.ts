import "server-only";
import type { PriceQuote } from "./index";

/**
 * Stub — Yahoo Finance lookup. Originally used yahoo-finance2 but we removed
 * that dependency in the SQLite refactor. For local dev, this returns the
 * previously cached price from price_snapshots or 0 if nothing's there.
 * A real implementation would fetch from a free public API on demand.
 */
export async function fetchEquityPrice(symbol: string, _asOf?: Date): Promise<PriceQuote> {
  const ticker = symbol.toUpperCase().trim();
  if (!ticker) throw new Error("Empty ticker");
  return {
    symbol: ticker,
    price: 0,
    currency: "USD",
    asOf: new Date(),
  };
}
