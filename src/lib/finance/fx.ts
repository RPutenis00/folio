/**
 * FX conversion helpers. All amounts are decimal numbers (not bigint).
 * Rates are quoted as "1 base = X quote" — pass the rate that turns
 * the asset's native currency INTO EUR.
 */

export function toEur(amount: number, fxRateToEur: number): number {
  return amount * fxRateToEur;
}

export function fromEur(amountEur: number, fxRateFromEur: number): number {
  return amountEur * fxRateFromEur;
}

/**
 * Combine two rates: e.g. USD→GBP via USD→EUR + EUR→GBP.
 * Returns the rate that turns 1 unit of `from` currency into `to`.
 */
export function combineRates(fromToEur: number, eurToTarget: number): number {
  return fromToEur * eurToTarget;
}
