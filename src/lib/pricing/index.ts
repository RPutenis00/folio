import "server-only";

export type PriceQuote = {
  symbol: string;
  price: number;
  currency: string;
  asOf: Date;
};

export interface PricingProvider {
  supports(assetClass: "equity" | "crypto"): boolean;
  fetchPrice(symbol: string, asOf?: Date): Promise<PriceQuote>;
}

export { fetchEquityPrice } from "./yahoo";
export { fetchCryptoPrice } from "./coingecko";
export { fetchEurFxRate, fetchEurFxRates } from "./frankfurter";

import { fetchEquityPrice } from "./yahoo";
import { fetchCryptoPrice } from "./coingecko";

/**
 * Dispatch to the right adapter by asset class. Throws if the symbol can't
 * be resolved or the provider errors — caller decides how to surface.
 */
export async function getPrice(
  symbol: string,
  assetClass: "equity" | "crypto",
  asOf?: Date,
): Promise<PriceQuote> {
  if (assetClass === "equity") return fetchEquityPrice(symbol, asOf);
  return fetchCryptoPrice(symbol, asOf);
}
