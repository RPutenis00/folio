import { describe, it, expect } from "vitest";
import { deriveLots, marketValue, unrealizedPnl, type Tx } from "@/lib/finance/cost-basis";

const buy = (
  quantity: number,
  unitPrice: number,
  fees = 0,
  fx = 1,
  occurredAt = "2024-01-01",
): Tx => ({
  type: "buy",
  quantity,
  unitPrice,
  totalAmount: quantity * unitPrice,
  fees,
  fxRateToEur: fx,
  occurredAt,
});

const sell = (
  quantity: number,
  unitPrice: number,
  fees = 0,
  fx = 1,
  occurredAt = "2024-06-01",
): Tx => ({
  type: "sell",
  quantity,
  unitPrice,
  totalAmount: quantity * unitPrice,
  fees,
  fxRateToEur: fx,
  occurredAt,
});

describe("deriveLots", () => {
  it("single buy → one open lot, weighted avg = price + fee/qty", () => {
    const p = deriveLots([buy(10, 100, 5)]);
    expect(p.currentQuantity).toBe(10);
    // cost = (10*100 + 5) / 10 = 100.5
    expect(p.averageCostEur).toBeCloseTo(100.5, 6);
    expect(p.totalCostEur).toBeCloseTo(1005, 6);
    expect(p.realizedPnlEur).toBe(0);
  });

  it("two buys at different prices → weighted average", () => {
    const p = deriveLots([buy(10, 100, 0, 1, "2024-01-01"), buy(10, 200, 0, 1, "2024-02-01")]);
    expect(p.currentQuantity).toBe(20);
    expect(p.averageCostEur).toBeCloseTo(150, 6);
    expect(p.totalCostEur).toBeCloseTo(3000, 6);
  });

  it("FIFO: sell consumes oldest lot first; realized PnL is correct", () => {
    const txs = [
      buy(10, 100, 0, 1, "2024-01-01"),
      buy(10, 200, 0, 1, "2024-02-01"),
      sell(15, 250, 0, 1, "2024-03-01"),
    ];
    const p = deriveLots(txs);
    expect(p.currentQuantity).toBe(5);
    // sold 10 @ cost 100 → pnl 10*(250-100)=1500
    // sold 5  @ cost 200 → pnl  5*(250-200)= 250
    expect(p.realizedPnlEur).toBeCloseTo(1750, 4);
    // remaining: 5 units of second lot at cost 200
    expect(p.totalCostEur).toBeCloseTo(1000, 4);
    expect(p.averageCostEur).toBeCloseTo(200, 4);
  });

  it("FX-converted buy stores cost in EUR", () => {
    // 10 USD @ 100 with rate 0.9 → 900 EUR cost
    const p = deriveLots([buy(10, 100, 0, 0.9)]);
    expect(p.totalCostEur).toBeCloseTo(900, 6);
    expect(p.averageCostEur).toBeCloseTo(90, 6);
  });

  it("dividends accumulate; fees accumulate", () => {
    const div: Tx = {
      type: "dividend",
      quantity: null,
      unitPrice: null,
      totalAmount: 42,
      fees: 0,
      fxRateToEur: 1,
      occurredAt: "2024-04-01",
    };
    const fee: Tx = {
      type: "fee",
      quantity: null,
      unitPrice: null,
      totalAmount: 3,
      fees: 0,
      fxRateToEur: 1,
      occurredAt: "2024-04-01",
    };
    const p = deriveLots([buy(10, 100), div, fee]);
    expect(p.totalDividendsEur).toBeCloseTo(42, 6);
    expect(p.totalFeesEur).toBeCloseTo(3, 6);
  });

  it("marketValue + unrealizedPnl agree with hand calc", () => {
    const p = deriveLots([buy(10, 100)]);
    expect(marketValue(p, 150)).toBe(1500);
    expect(unrealizedPnl(p, 150)).toBe(500);
  });

  it("transactions are sorted by occurredAt — out-of-order input still FIFO", () => {
    const txs = [
      buy(10, 200, 0, 1, "2024-02-01"),
      buy(10, 100, 0, 1, "2024-01-01"),
      sell(10, 250, 0, 1, "2024-03-01"),
    ];
    const p = deriveLots(txs);
    // FIFO sells the Jan lot first (cost 100), pnl = 10*(250-100)=1500
    expect(p.realizedPnlEur).toBeCloseTo(1500, 4);
    expect(p.currentQuantity).toBe(10);
    expect(p.averageCostEur).toBeCloseTo(200, 4);
  });
});
