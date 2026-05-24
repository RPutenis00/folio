import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeScenario, type ScenarioInput } from "@/lib/finance/yields";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { RENTAL_STRATEGY_LABEL } from "@/lib/constants";
import type { RentalScenario } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";

export function ScenarioComparison({
  scenarios,
  propertyValueEur,
  totalCashInvestedEur,
}: {
  scenarios: RentalScenario[];
  propertyValueEur: number;
  totalCashInvestedEur: number;
}) {
  if (scenarios.length === 0) return null;

  const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

  const computed = scenarios.map((s) => {
    const input: ScenarioInput = {
      strategy: s.strategy as ScenarioInput["strategy"],
      monthlyRent: s.monthlyRent != null ? num(s.monthlyRent) : null,
      vacancyPct: s.vacancyPct != null ? num(s.vacancyPct) : 0,
      nightlyRate: s.nightlyRate != null ? num(s.nightlyRate) : null,
      occupancyPct: s.occupancyPct != null ? num(s.occupancyPct) : null,
      cleaningFeePerStay: s.cleaningFeePerStay != null ? num(s.cleaningFeePerStay) : 0,
      avgStayNights: s.avgStayNights != null ? num(s.avgStayNights) : null,
      platformFeePct: s.platformFeePct != null ? num(s.platformFeePct) : 0,
      managementFeePct: s.managementFeePct != null ? num(s.managementFeePct) : 0,
      ltrMonthsPerYear: s.ltrMonthsPerYear ?? null,
      monthlyOpex: s.monthlyOpex != null ? num(s.monthlyOpex) : 0,
    };
    return {
      scenario: s,
      metrics: computeScenario(input, {
        propertyValueEur,
        totalCashInvestedEur,
      }),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Side-by-side</CardTitle>
        <CardDescription>Computed annualised metrics for each scenario.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  Scenario
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  Gross income / yr
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  OPEX / yr
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  NOI
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  Gross yield
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  Net yield
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  Cash-on-cash
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
                  Payback (yrs)
                </th>
              </tr>
            </thead>
            <tbody>
              {computed.map(({ scenario, metrics }) => (
                <tr key={scenario.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{scenario.name}</span>
                      <Badge variant="muted">
                        {RENTAL_STRATEGY_LABEL[scenario.strategy as keyof typeof RENTAL_STRATEGY_LABEL]}
                      </Badge>
                      {scenario.isCurrent ? <Badge variant="accent">Current</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(metrics.annualGrossIncomeEur)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                    {formatCurrency(metrics.annualOperatingExpensesEur)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(metrics.noiEur)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(metrics.grossYield)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(metrics.netYield)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(metrics.cashOnCash)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number.isFinite(metrics.paybackYears) ? metrics.paybackYears.toFixed(1) : "∞"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
