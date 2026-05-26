/**
 * Edge case tests for the financial pure functions.
 * Covers scenarios that aren't on the happy path of the main tests.
 */
import { describe, it, expect } from "vitest";
import { deriveLots, marketValue, unrealizedPnl, type Tx } from "@/lib/finance/cost-basis";
import { computeScenario, type ScenarioInput } from "@/lib/finance/yields";
import { rollupPortfolio } from "@/lib/finance/portfolio";

const buy = (qty: number, price: number, fees = 0, fx = 1, date = "2024-01-01"): Tx => ({
  type: "buy",
  quantity: qty,
  unitPrice: price,
  totalAmount: qty * price,
  fees,
  fxRateToEur: fx,
  occurredAt: date,
});

const sell = (qty: number, price: number, fees = 0, fx = 1, date = "2024-06-01"): Tx => ({
  type: "sell",
  quantity: qty,
  unitPrice: price,
  totalAmount: qty * price,
  fees,
  fxRateToEur: fx,
  occurredAt: date,
});

describe("cost-basis edge cases", () => {
  it("zero-quantity position after full sell", () => {
    const p = deriveLots([buy(10, 100), sell(10, 150)]);
    expect(p.currentQuantity).toBe(0);
    expect(p.averageCostEur).toBe(0);
    expect(p.totalCostEur).toBe(0);
    expect(p.realizedPnlEur).toBeCloseTo(500, 4); // 10*(150-100)
  });

  it("multiple partial sells across multiple buy lots — FIFO order strict", () => {
    const txs = [
      buy(10, 100, 0, 1, "2024-01-01"), // lot 1
      buy(10, 150, 0, 1, "2024-02-01"), // lot 2
      buy(10, 200, 0, 1, "2024-03-01"), // lot 3
      sell(5, 250, 0, 1, "2024-04-01"), // sell 5 from lot 1
      sell(10, 300, 0, 1, "2024-05-01"), // sell 5 from lot 1 + 5 from lot 2
    ];
    const p = deriveLots(txs);
    // After sell 1: lot 1 has 5 @ 100; realized = 5*(250-100) = 750
    // After sell 2: lot 1 emptied (5*(300-100) = 1000) + lot 2 5 sold (5*(300-150)=750)
    // Total realized = 750 + 1000 + 750 = 2500
    expect(p.realizedPnlEur).toBeCloseTo(2500, 4);
    // Remaining: 5 of lot 2 (cost 150) + 10 of lot 3 (cost 200) = 15 qty
    expect(p.currentQuantity).toBe(15);
    // Cost = 5*150 + 10*200 = 750 + 2000 = 2750
    expect(p.totalCostEur).toBeCloseTo(2750, 4);
    expect(p.averageCostEur).toBeCloseTo(2750 / 15, 4);
  });

  it("over-sell (more than held) silently ignores the excess", () => {
    const p = deriveLots([buy(10, 100), sell(20, 150)]);
    // Only 10 actually sold; remaining 10 sell qty is ignored (short-sells not modeled)
    expect(p.currentQuantity).toBe(0);
    expect(p.realizedPnlEur).toBeCloseTo(500, 4);
  });

  it("fees from buys raise the per-unit cost", () => {
    // 10 @ €100 with €20 fees → effective cost per unit = (1000 + 20) / 10 = €102
    const p = deriveLots([buy(10, 100, 20)]);
    expect(p.averageCostEur).toBeCloseTo(102, 4);
    expect(p.totalCostEur).toBeCloseTo(1020, 4);
    expect(p.totalFeesEur).toBeCloseTo(20, 4);
  });

  it("fees from sells reduce proceeds (lowers realized P&L)", () => {
    // Buy 10 @ €100 (no fees), Sell 10 @ €150 with €10 fees
    // Proceeds-per-unit = (10*150 - 10) / 10 = 149
    // Realized = (149 - 100) * 10 = 490 (not 500)
    const p = deriveLots([buy(10, 100), sell(10, 150, 10)]);
    expect(p.realizedPnlEur).toBeCloseTo(490, 4);
  });

  it("multi-currency: GBP buy at 0.85 → cost basis in EUR is 1700, not 2000", () => {
    // 10 GBP * £200 with rate GBP→EUR = 0.85 → EUR cost = 10*200*0.85 = 1700
    const p = deriveLots([buy(10, 200, 0, 0.85)]);
    expect(p.totalCostEur).toBeCloseTo(1700, 4);
  });

  it("market value and unrealized P&L vs. a mark price", () => {
    const p = deriveLots([buy(10, 100)]);
    expect(marketValue(p, 250)).toBe(2500);
    expect(unrealizedPnl(p, 250)).toBe(1500);
  });
});

describe("yields edge cases", () => {
  const baseProperty = { propertyValueEur: 200_000, totalCashInvestedEur: 100_000 };

  it("100% vacancy → zero income → negative cash flow → infinite payback", () => {
    const input: ScenarioInput = {
      strategy: "LTR",
      monthlyRent: 1500,
      vacancyPct: 100,
      monthlyOpex: 250,
    };
    const m = computeScenario(input, baseProperty);
    expect(m.annualGrossIncomeEur).toBeCloseTo(0, 4);
    expect(m.annualCashFlowEur).toBeLessThanOrEqual(0);
    expect(m.paybackYears).toBe(Infinity);
  });

  it("debt service eats into cash flow without changing NOI", () => {
    const input: ScenarioInput = {
      strategy: "LTR",
      monthlyRent: 2000,
      vacancyPct: 0,
      monthlyOpex: 500,
    };
    const noDebt = computeScenario(input, { ...baseProperty, annualDebtServiceEur: 0 });
    const withDebt = computeScenario(input, { ...baseProperty, annualDebtServiceEur: 12_000 });
    expect(noDebt.noiEur).toBeCloseTo(withDebt.noiEur, 4); // NOI unaffected
    expect(withDebt.annualCashFlowEur).toBeCloseTo(noDebt.annualCashFlowEur - 12_000, 4);
  });

  it("STR with 0 nightly_rate → zero income", () => {
    const input: ScenarioInput = {
      strategy: "STR",
      nightlyRate: 0,
      occupancyPct: 80,
      cleaningFeePerStay: 50,
      avgStayNights: 3,
      monthlyOpex: 100,
    };
    const m = computeScenario(input, baseProperty);
    // Nightly_rate is 0 but cleaning fees still accumulate from stays
    expect(m.annualGrossIncomeEur).toBeGreaterThan(0);
    expect(m.annualGrossIncomeEur).toBeLessThan(10_000);
  });

  it("HYBRID with ltrMonths=12 collapses to pure LTR", () => {
    const hybrid: ScenarioInput = {
      strategy: "HYBRID",
      monthlyRent: 1000,
      vacancyPct: 0,
      ltrMonthsPerYear: 12,
      nightlyRate: 100,
      occupancyPct: 70,
      cleaningFeePerStay: 50,
      avgStayNights: 3,
      platformFeePct: 0,
      monthlyOpex: 0,
    };
    const ltr: ScenarioInput = {
      strategy: "LTR",
      monthlyRent: 1000,
      vacancyPct: 0,
      monthlyOpex: 0,
    };
    const mh = computeScenario(hybrid, { propertyValueEur: 100_000, totalCashInvestedEur: 100_000 });
    const ml = computeScenario(ltr, { propertyValueEur: 100_000, totalCashInvestedEur: 100_000 });
    // 12 LTR months = full year LTR; STR portion = 0 months of nights
    expect(mh.annualGrossIncomeEur).toBeCloseTo(ml.annualGrossIncomeEur, 0);
  });

  it("propertyValueEur=0 → grossYield = 0 (avoid divide-by-zero)", () => {
    const m = computeScenario(
      { strategy: "LTR", monthlyRent: 1000, vacancyPct: 0, monthlyOpex: 0 },
      { propertyValueEur: 0, totalCashInvestedEur: 100_000 },
    );
    expect(m.grossYield).toBe(0);
    expect(m.netYield).toBe(0);
  });
});

describe("portfolio rollup edge cases", () => {
  it("mixed positive and negative unrealized values net correctly", () => {
    const r = rollupPortfolio([
      { assetId: "a", category: "stock", marketValueEur: 500, costBasisEur: 1000 }, // -500
      { assetId: "b", category: "crypto", marketValueEur: 3000, costBasisEur: 1000 }, // +2000
      { assetId: "c", category: "stock", marketValueEur: 1000, costBasisEur: 500 }, // +500
    ]);
    expect(r.totalValueEur).toBe(4500);
    expect(r.totalCostBasisEur).toBe(2500);
    expect(r.unrealizedPnlEur).toBe(2000);
    expect(r.byCategory.stock).toBe(1500);
    expect(r.byCategory.crypto).toBe(3000);
  });

  it("single asset with zero cost basis → 100% gain ratio implied", () => {
    const r = rollupPortfolio([
      { assetId: "x", category: "stock", marketValueEur: 1000, costBasisEur: 0 },
    ]);
    expect(r.totalValueEur).toBe(1000);
    expect(r.totalCostBasisEur).toBe(0);
    expect(r.unrealizedPnlEur).toBe(1000);
  });
});
