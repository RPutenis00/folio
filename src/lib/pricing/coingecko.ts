import "server-only";
import type { PriceQuote } from "./index";

const SIMPLE_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  XRP: "ripple",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  ALGO: "algorand",
  XLM: "stellar",
  TRX: "tron",
  NEAR: "near",
  ARB: "arbitrum",
  OP: "optimism",
  UNI: "uniswap",
  AAVE: "aave",
  USDT: "tether",
  USDC: "usd-coin",
};

/**
 * Resolve a user-friendly ticker (BTC, ETH, …) to CoinGecko's coin id.
 * Falls back to `/search?query=` if not in our hard-coded map.
 */
async function resolveCoinId(symbol: string): Promise<string | null> {
  const upper = symbol.toUpperCase().trim();
  if (SIMPLE_MAP[upper]) return SIMPLE_MAP[upper];

  const res = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(upper)}`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { coins?: Array<{ id: string; symbol: string }> };
  const match = json.coins?.find((c) => c.symbol?.toUpperCase() === upper);
  return match?.id ?? null;
}

export async function fetchCryptoPrice(symbol: string, asOf?: Date): Promise<PriceQuote> {
  const id = await resolveCoinId(symbol);
  if (!id) throw new Error(`Unknown crypto ticker: ${symbol}`);

  if (asOf) {
    const dd = String(asOf.getUTCDate()).padStart(2, "0");
    const mm = String(asOf.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = asOf.getUTCFullYear();
    const url = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${dd}-${mm}-${yyyy}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`CoinGecko history error: ${res.status}`);
    const json = (await res.json()) as {
      market_data?: { current_price?: Record<string, number> };
    };
    const price = json.market_data?.current_price?.eur;
    if (price == null) throw new Error(`No historical price for ${symbol} on ${yyyy}-${mm}-${dd}`);
    return { symbol: symbol.toUpperCase(), price, currency: "EUR", asOf };
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=eur`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) throw new Error(`CoinGecko price error: ${res.status}`);
  const json = (await res.json()) as Record<string, { eur?: number }>;
  const price = json[id]?.eur;
  if (price == null) throw new Error(`No price for ${symbol}`);
  return { symbol: symbol.toUpperCase(), price, currency: "EUR", asOf: new Date() };
}
