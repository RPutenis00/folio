import { describe, it, expect } from "vitest";
import {
  annualGrossIncome,
  annualOperatingExpenses,
  computeScenario,
  type ScenarioInput,
} from "@/lib/finance/yields";

const ltr: ScenarioInput = {
  strategy: "LTR",
  monthlyRent: 1500,
  vacancyPct: 5, // 5% vacancy
  monthlyOpex: 250,
};

const str: ScenarioInput = {
  strategy: "STR",
  nightlyRate: 120,
  occupancyPct: 70,
  cleaningFeePerStay: 60,
  avgStayNights: 3,
  platformFeePct: 15,
  managementFeePct: 0,
  monthlyOpex: 400,
};

describe("annualGrossIncome", () => {
  it("LTR = monthly_rent * 12 * (1 - vacancy)", () => {
    // 1500 * 12 * 0.95 = 17100
    expect(annualGrossIncome(ltr)).toBeCloseTo(17100, 2);
  });

  it("STR = rate * occupied nights + cleaning * stays", () => {
    // nights = 365 * 0.70 = 255.5
    // gross  = 120 * 255.5 = 30660
    // stays  = 255.5 / 3 = 85.166...
    // cleaning = 60 * 85.166... = 5110
    // total = 35770
    expect(annualGrossIncome(str)).toBeCloseTo(35770, 1);
  });

  it("HYBRID blends LTR months + STR months", () => {
    const hybrid: ScenarioInput = {
      ...ltr,
      strategy: "HYBRID",
      ltrMonthsPerYear: 6,
      nightlyRate: 120,
      occupancyPct: 70,
      cleaningFeePerStay: 60,
      avgStayNights: 3,
      vacancyPct: 0,
    };
    // LTR half: 1500 * 6 = 9000
    // STR half: 365/2 = 182.5 days, occupied = 127.75 nights
    //   gross 127.75 * 120 = 15330, stays 127.75/3 = 42.583, cleaning 2555
    //   STR total ≈ 17885
    // grand total ≈ 26885
    expect(annualGrossIncome(hybrid)).toBeCloseTo(26885, 0);
  });
});

describe("annualOperatingExpenses", () => {
  it("LTR = fixed only (no platform/management fees set)", () => {
    expect(annualOperatingExpenses(ltr, 17100)).toBeCloseTo(3000, 2);
  });

  it("STR adds variable platform fee on the gross", () => {
    // fixed: 400*12 = 4800; variable: 35770 * 0.15 = 5365.5
    expect(annualOperatingExpenses(str, 35770)).toBeCloseTo(10165.5, 2);
  });
});

describe("computeScenario", () => {
  it("LTR yields with no debt", () => {
    const m = computeScenario(ltr, {
      propertyValueEur: 300_000,
      totalCashInvestedEur: 100_000,
      annualDebtServiceEur: 0,
    });
    expect(m.annualGrossIncomeEur).toBeCloseTo(17100, 2);
    expect(m.noiEur).toBeCloseTo(14100, 2);
    expect(m.annualCashFlowEur).toBeCloseTo(14100, 2);
    expect(m.grossYield).toBeCloseTo(0.057, 4);
    expect(m.netYield).toBeCloseTo(0.047, 3);
    expect(m.cashOnCash).toBeCloseTo(0.141, 3);
    expect(m.paybackYears).toBeCloseTo(100_000 / 14100, 2);
  });

  it("payback is Infinity when cash flow is non-positive", () => {
    const m = computeScenario(
      { ...ltr, monthlyOpex: 5000 },
      { propertyValueEur: 100_000, totalCashInvestedEur: 50_000 },
    );
    expect(m.annualCashFlowEur).toBeLessThanOrEqual(0);
    expect(m.paybackYears).toBe(Infinity);
  });
});
