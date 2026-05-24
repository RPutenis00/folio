import "server-only";
import YahooFinance from "yahoo-finance2";
import type { PriceQuote } from "./index";

// One process-wide instance is fine — it's stateless.
const yf = new YahooFinance();
yf._notices.suppress(["yahooSurvey"]);

/**
 * Latest spot quote (most recent regular market close).
 * If `asOf` is supplied, falls back to a historical close on that date (±2-day window).
 */
export async function fetchEquityPrice(symbol: string, asOf?: Date): Promise<PriceQuote> {
  const ticker = symbol.toUpperCase().trim();
  if (!ticker) throw new Error("Empty ticker");

  if (asOf) {
    const start = new Date(asOf);
    start.setDate(start.getDate() - 2);
    const end = new Date(asOf);
    end.setDate(end.getDate() + 1);
    const rows = await yf.chart(ticker, {
      period1: start,
      period2: end,
      interval: "1d",
    });
    const last = rows.quotes?.at(-1);
    if (last?.close) {
      return {
        symbol: ticker,
        price: last.close,
        currency: rows.meta?.currency ?? "USD",
        asOf: new Date(last.date),
      };
    }
  }

  const q = await yf.quote(ticker);
  const quote = Array.isArray(q) ? q[0] : q;
  if (!quote || quote.regularMarketPrice == null) {
    throw new Error(`No price for ${ticker}`);
  }
  return {
    symbol: ticker,
    price: quote.regularMarketPrice,
    currency: quote.currency ?? "USD",
    asOf: new Date((quote.regularMarketTime ?? Date.now() / 1000) * 1000),
  };
}
