/**
 * Position and cost-basis derivation from a stream of transactions.
 *
 * Input transactions for a single asset, sorted oldest-first:
 *   { type: 'buy' | 'sell', quantity, unitPrice, fees, fxRateToEur, occurredAt }
 *
 * Output:
 *   - currentQuantity
 *   - averageCostEur (weighted by quantity remaining)
 *   - totalCostEur (open lots only — sold lots removed FIFO)
 *   - realizedPnlEur (running total across all sells)
 *
 * FIFO matching: each sell consumes from the oldest open lot first.
 *
 * All math in EUR. Native-currency math has already been converted
 * upstream using the stored fx_rate_to_eur.
 */

export type Lot = {
  quantityRemaining: number;
  costPerUnitEur: number;
  acquiredAt: string;
};

export type Tx = {
  type: "buy" | "sell" | "dividend" | "fee" | "income" | "expense" | "valuation" | "transfer_in" | "transfer_out";
  quantity: number | null;
  unitPrice: number | null;
  totalAmount: number;
  fees: number;
  fxRateToEur: number;
  occurredAt: string;
};

export type Position = {
  currentQuantity: number;
  averageCostEur: number;
  totalCostEur: number;
  realizedPnlEur: number;
  totalFeesEur: number;
  totalDividendsEur: number;
  openLots: Lot[];
};

const EPSILON = 1e-9;

export function deriveLots(transactions: Tx[]): Position {
  // Stable sort by occurredAt ascending, then by index (input order tiebreaker).
  const sorted = [...transactions]
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      if (a.t.occurredAt < b.t.occurredAt) return -1;
      if (a.t.occurredAt > b.t.occurredAt) return 1;
      return a.i - b.i;
    })
    .map((x) => x.t);

  const openLots: Lot[] = [];
  let realizedPnlEur = 0;
  let totalFeesEur = 0;
  let totalDividendsEur = 0;

  for (const tx of sorted) {
    const feesEur = (tx.fees ?? 0) * tx.fxRateToEur;
    totalFeesEur += feesEur;

    if (tx.type === "buy" && tx.quantity != null && tx.unitPrice != null) {
      const grossEur = tx.quantity * tx.unitPrice * tx.fxRateToEur;
      const costPerUnitEur = (grossEur + feesEur) / tx.quantity;
      openLots.push({
        quantityRemaining: tx.quantity,
        costPerUnitEur,
        acquiredAt: tx.occurredAt,
      });
    } else if (tx.type === "sell" && tx.quantity != null && tx.unitPrice != null) {
      let remainingToSell = tx.quantity;
      const proceedsPerUnitEur =
        (tx.quantity * tx.unitPrice * tx.fxRateToEur - feesEur) / tx.quantity;

      while (remainingToSell > EPSILON && openLots.length > 0) {
        const lot = openLots[0]!;
        const consumed = Math.min(lot.quantityRemaining, remainingToSell);
        const pnl = (proceedsPerUnitEur - lot.costPerUnitEur) * consumed;
        realizedPnlEur += pnl;
        lot.quantityRemaining -= consumed;
        remainingToSell -= consumed;
        if (lot.quantityRemaining <= EPSILON) {
          openLots.shift();
        }
      }
      // Short-sells produce a negative open-lot — not modeled in MVP.
      // If remainingToSell > 0 here, we silently ignore the over-sell.
    } else if (tx.type === "dividend") {
      totalDividendsEur += tx.totalAmount * tx.fxRateToEur;
    } else if (tx.type === "fee") {
      totalFeesEur += tx.totalAmount * tx.fxRateToEur;
    }
  }

  const currentQuantity = openLots.reduce((s, l) => s + l.quantityRemaining, 0);
  const totalCostEur = openLots.reduce(
    (s, l) => s + l.quantityRemaining * l.costPerUnitEur,
    0,
  );
  const averageCostEur = currentQuantity > EPSILON ? totalCostEur / currentQuantity : 0;

  return {
    currentQuantity,
    averageCostEur,
    totalCostEur,
    realizedPnlEur,
    totalFeesEur,
    totalDividendsEur,
    openLots,
  };
}

/**
 * Unrealized P&L at a given mark price (in EUR).
 * Pass the latest price * fxRateToEur as `currentPriceEur`.
 */
export function unrealizedPnl(position: Position, currentPriceEur: number): number {
  return position.currentQuantity * currentPriceEur - position.totalCostEur;
}

/** Current market value of the open position in EUR. */
export function marketValue(position: Position, currentPriceEur: number): number {
  return position.currentQuantity * currentPriceEur;
}
