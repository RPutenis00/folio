/**
 * Real-estate yield, cash-flow, and ROI calculations.
 *
 * All inputs in EUR. Pure functions — DB / network usage forbidden here.
 *
 * Glossary:
 *   - Gross yield   = annual gross rental income / property value
 *   - Net yield     = (annual gross rental income − annual operating expenses) / property value
 *   - NOI           = annual gross rental income − annual operating expenses
 *   - Cash flow     = NOI − annual debt service (mortgage payments)
 *   - Cash-on-cash  = annual cash flow / total cash invested
 *   - Payback (yrs) = total cash invested / annual cash flow (∞ if cash flow ≤ 0)
 */

import type { RentalStrategy } from "../constants";

export type ScenarioInput = {
  strategy: RentalStrategy;
  /** Long-term monthly rent */
  monthlyRent?: number | null;
  /** Long-term vacancy assumption, 0–100 (percent) */
  vacancyPct?: number | null;
  /** Short-term nightly rate */
  nightlyRate?: number | null;
  /** Short-term occupancy, 0–100 (percent) */
  occupancyPct?: number | null;
  /** Short-term cleaning fee per stay */
  cleaningFeePerStay?: number | null;
  /** Short-term average stay length in nights */
  avgStayNights?: number | null;
  /** Platform fee (Airbnb/Booking), 0–100 */
  platformFeePct?: number | null;
  /** Management company fee, 0–100 */
  managementFeePct?: number | null;
  /** Hybrid: months of the year operated as LTR; remainder as STR */
  ltrMonthsPerYear?: number | null;
  /** Recurring monthly operating costs not included in fees above (insurance, tax, HOA, utilities, etc.) */
  monthlyOpex: number;
};

export type ScenarioCosts = {
  /** Current property valuation in EUR */
  propertyValueEur: number;
  /** Total cash invested = purchase + cumulative capex (renovations, furnishing, fees) */
  totalCashInvestedEur: number;
  /** Annual mortgage payments (P+I) in EUR; 0 if no mortgage */
  annualDebtServiceEur?: number;
};

export type ScenarioMetrics = {
  annualGrossIncomeEur: number;
  annualOperatingExpensesEur: number;
  noiEur: number;
  annualCashFlowEur: number;
  grossYield: number;
  netYield: number;
  cashOnCash: number;
  paybackYears: number;
};

const pct = (v?: number | null) => (v == null ? 0 : v / 100);

/** Annual gross income across the year, blending LTR + STR for HYBRID. */
export function annualGrossIncome(input: ScenarioInput): number {
  if (input.strategy === "LTR") {
    const rent = input.monthlyRent ?? 0;
    return rent * 12 * (1 - pct(input.vacancyPct));
  }

  if (input.strategy === "STR") {
    const nights = 365 * pct(input.occupancyPct);
    const gross = (input.nightlyRate ?? 0) * nights;
    const stays = (input.avgStayNights ?? 0) > 0 ? nights / (input.avgStayNights ?? 1) : 0;
    return gross + (input.cleaningFeePerStay ?? 0) * stays;
  }

  // HYBRID: split the year by months. LTR months get monthlyRent;
  // STR portion uses occupancy_pct over the remaining nights.
  const ltrMonths = Math.max(0, Math.min(12, input.ltrMonthsPerYear ?? 6));
  const strMonths = 12 - ltrMonths;
  const ltrIncome = (input.monthlyRent ?? 0) * ltrMonths * (1 - pct(input.vacancyPct));
  const strDays = (strMonths / 12) * 365;
  const strNightsBooked = strDays * pct(input.occupancyPct);
  const strGross = (input.nightlyRate ?? 0) * strNightsBooked;
  const strStays =
    (input.avgStayNights ?? 0) > 0 ? strNightsBooked / (input.avgStayNights ?? 1) : 0;
  return ltrIncome + strGross + (input.cleaningFeePerStay ?? 0) * strStays;
}

/** Annual operating expenses: fixed opex + variable platform/management fees on the gross. */
export function annualOperatingExpenses(input: ScenarioInput, gross: number): number {
  const fixed = input.monthlyOpex * 12;
  const variable = gross * (pct(input.platformFeePct) + pct(input.managementFeePct));
  return fixed + variable;
}

export function computeScenario(
  input: ScenarioInput,
  costs: ScenarioCosts,
): ScenarioMetrics {
  const annualGrossIncomeEur = annualGrossIncome(input);
  const annualOperatingExpensesEur = annualOperatingExpenses(input, annualGrossIncomeEur);
  const noiEur = annualGrossIncomeEur - annualOperatingExpensesEur;
  const annualCashFlowEur = noiEur - (costs.annualDebtServiceEur ?? 0);

  const grossYield = costs.propertyValueEur > 0 ? annualGrossIncomeEur / costs.propertyValueEur : 0;
  const netYield = costs.propertyValueEur > 0 ? noiEur / costs.propertyValueEur : 0;
  const cashOnCash =
    costs.totalCashInvestedEur > 0 ? annualCashFlowEur / costs.totalCashInvestedEur : 0;
  const paybackYears =
    annualCashFlowEur > 0 ? costs.totalCashInvestedEur / annualCashFlowEur : Infinity;

  return {
    annualGrossIncomeEur,
    annualOperatingExpensesEur,
    noiEur,
    annualCashFlowEur,
    grossYield,
    netYield,
    cashOnCash,
    paybackYears,
  };
}
