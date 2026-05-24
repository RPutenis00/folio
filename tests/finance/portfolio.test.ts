import { describe, it, expect } from "vitest";
import { rollupPortfolio } from "@/lib/finance/portfolio";

describe("rollupPortfolio", () => {
  it("sums and groups by category", () => {
    const r = rollupPortfolio([
      { assetId: "1", category: "stock", marketValueEur: 1000, costBasisEur: 800 },
      { assetId: "2", category: "stock", marketValueEur: 500, costBasisEur: 400 },
      { assetId: "3", category: "crypto", marketValueEur: 2000, costBasisEur: 1500 },
      { assetId: "4", category: "real_estate", marketValueEur: 300_000, costBasisEur: 270_000 },
    ]);
    expect(r.totalValueEur).toBe(303_500);
    expect(r.totalCostBasisEur).toBe(272_700);
    expect(r.unrealizedPnlEur).toBe(30_800);
    expect(r.byCategory.stock).toBe(1500);
    expect(r.byCategory.crypto).toBe(2000);
    expect(r.byCategory.real_estate).toBe(300_000);
    expect(r.byCategory.bond).toBe(0);
  });

  it("empty input gives zeros", () => {
    const r = rollupPortfolio([]);
    expect(r.totalValueEur).toBe(0);
    expect(r.totalCostBasisEur).toBe(0);
    expect(r.unrealizedPnlEur).toBe(0);
    expect(r.byCategory.stock).toBe(0);
  });
});
