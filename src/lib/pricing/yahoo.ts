import "server-only";
import type { PriceQuote } from "./index";

/**
 * Equity price adapter.
 *
 * Primary:  Stooq (https://stooq.com) — keyless CSV endpoint, very reliable.
 *   GET https://stooq.com/q/l/?s=AAPL.US&f=sd2t2ohlcv&h&e=csv
 *   → Symbol,Date,Time,Open,High,Low,Close,Volume
 *
 * Fallback: Yahoo Finance v8 chart endpoint (heavily rate-limited).
 *
 * Symbol normalisation:
 *   - "AAPL"      → "AAPL.US"   (US stocks: append .US)
 *   - "VOO"       → "VOO.US"
 *   - "ASML.AS"   → kept as-is  (already has suffix)
 *   - "BTC-USD"   → kept as-is, but treated by crypto adapter (not here)
 *
 * Returns price in the listing currency; FX-to-EUR is handled downstream.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Map a user-entered ticker to a Stooq symbol. */
function toStooqSymbol(ticker: string): string {
  const t = ticker.toUpperCase().trim();
  if (t.includes(".")) return t; // already qualified
  // Heuristic: assume US listing.
  return `${t}.US`;
}

async function fetchFromStooq(symbol: string): Promise<PriceQuote | null> {
  const stooq = toStooqSymbol(symbol);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooq.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;

  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/csv" },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;

  const csv = (await res.text()).trim();
  // Expect 2 lines: header + data
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = lines[0]!.split(",");
  const values = lines[1]!.split(",");
  const closeIdx = headers.findIndex((h) => h.toLowerCase() === "close");
  const dateIdx = headers.findIndex((h) => h.toLowerCase() === "date");
  const timeIdx = headers.findIndex((h) => h.toLowerCase() === "time");
  if (closeIdx < 0) return null;
  const closeStr = values[closeIdx]!;
  if (!closeStr || closeStr === "N/D") return null;
  const price = Number(closeStr);
  if (!Number.isFinite(price) || price <= 0) return null;

  // Stooq listings are in the local currency for the exchange.
  // .US → USD, .UK → GBP, .DE → EUR, etc. Reasonable default: infer from suffix.
  const suffix = stooq.split(".")[1] ?? "US";
  const currency = suffixToCurrency(suffix);

  const asOf =
    dateIdx >= 0 && values[dateIdx]
      ? new Date(`${values[dateIdx]}T${values[timeIdx] ?? "00:00:00"}Z`)
      : new Date();

  return {
    symbol: symbol.toUpperCase(),
    price,
    currency,
    asOf,
  };
}

function suffixToCurrency(suffix: string): string {
  const map: Record<string, string> = {
    US: "USD",
    UK: "GBP",
    L: "GBP",
    DE: "EUR",
    F: "EUR",
    PA: "EUR",
    AS: "EUR",
    MI: "EUR",
    MC: "EUR",
    BR: "EUR",
    HE: "EUR",
    LS: "EUR",
    VI: "EUR",
    JP: "JPY",
    T: "JPY",
    HK: "HKD",
    SS: "CNY",
    SZ: "CNY",
    TO: "CAD",
    AX: "AUD",
    NZ: "NZD",
    SW: "CHF",
    SI: "SGD",
    ST: "SEK",
    OL: "NOK",
    CO: "DKK",
    WA: "PLN",
    BU: "HUF",
    PR: "CZK",
  };
  return map[suffix.toUpperCase()] ?? "USD";
}

async function fetchFromYahoo(symbol: string): Promise<PriceQuote | null> {
  const ticker = symbol.toUpperCase().trim();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  type Y = {
    chart: { result?: Array<{ meta: { regularMarketPrice: number; currency: string; regularMarketTime: number } }> };
  };
  const json = (await res.json()) as Y;
  const r = json.chart.result?.[0];
  if (!r) return null;
  return {
    symbol: ticker,
    price: r.meta.regularMarketPrice,
    currency: r.meta.currency ?? "USD",
    asOf: new Date((r.meta.regularMarketTime ?? Date.now() / 1000) * 1000),
  };
}

export async function fetchEquityPrice(symbol: string, _asOf?: Date): Promise<PriceQuote> {
  const ticker = symbol.toUpperCase().trim();
  if (!ticker) throw new Error("Empty ticker");

  // Try Stooq first
  const stooq = await fetchFromStooq(ticker).catch(() => null);
  if (stooq) return stooq;

  // Fall back to Yahoo
  const yahoo = await fetchFromYahoo(ticker).catch(() => null);
  if (yahoo) return yahoo;

  throw new Error(`No price for ${ticker} (Stooq + Yahoo both failed)`);
}
