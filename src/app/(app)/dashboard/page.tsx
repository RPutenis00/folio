import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-user";
import { getPortfolio, listHoldingsSnapshots } from "@/lib/db/queries";
import { ASSET_CATEGORY_LABEL } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ValueOverTimeChart } from "@/components/charts/value-over-time-chart";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { KpiCard } from "@/components/kpi-card";
import { ChangeBadge } from "@/components/change-badge";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const portfolio = await getPortfolio(profile.id);
  const snapshots = await listHoldingsSnapshots(profile.id, 365);

  const chartData = snapshots.map((s) => ({
    date: s.asOf,
    value: Number(s.totalValueEur),
  }));

  // If there's no snapshot for today, append the live rollup so the chart
  // always shows a current point.
  const todayStr = new Date().toISOString().slice(0, 10);
  if (chartData.length === 0 || chartData[chartData.length - 1]?.date !== todayStr) {
    chartData.push({ date: todayStr, value: portfolio.rollup.totalValueEur });
  }

  const allocation = Object.entries(portfolio.rollup.byCategory)
    .map(([k, v]) => ({ label: ASSET_CATEGORY_LABEL[k as keyof typeof ASSET_CATEGORY_LABEL] ?? k, value: v }))
    .filter((s) => s.value > 0);

  const topMovers = [...portfolio.assets]
    .filter((a) => a.unrealizedPnlEur !== 0 && a.costBasisEur > 0)
    .sort((a, b) => Math.abs(b.unrealizedPnlEur) - Math.abs(a.unrealizedPnlEur))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            {greeting()}, {profile.displayName?.split(" ")[0] ?? "there"}
          </p>
          <h1 className="font-display text-3xl">Portfolio</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/assets/new"><Plus className="size-4" />New asset</Link>
          </Button>
          <RefreshAllButton />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total value"
          value={formatCurrency(portfolio.rollup.totalValueEur)}
          mono
          accent
        />
        <KpiCard label="Cost basis" value={formatCurrency(portfolio.rollup.totalCostBasisEur)} mono />
        <KpiCard
          label="Unrealized P&L"
          value={formatCurrency(portfolio.rollup.unrealizedPnlEur, { signed: true })}
          mono
          tone={portfolio.rollup.unrealizedPnlEur >= 0 ? "success" : "danger"}
          hint={
            portfolio.rollup.totalCostBasisEur > 0 ? (
              <span>
                {((portfolio.rollup.unrealizedPnlEur / portfolio.rollup.totalCostBasisEur) * 100).toFixed(1)}%
              </span>
            ) : null
          }
        />
        <KpiCard label="Dividends (lifetime)" value={formatCurrency(portfolio.totalDividendsEur)} mono subtle />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Value over time</CardTitle>
            <CardDescription>Daily snapshots from the cron job.</CardDescription>
          </CardHeader>
          <CardContent>
            <ValueOverTimeChart data={chartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>By asset category.</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationDonut data={allocation} totalEur={portfolio.rollup.totalValueEur} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top movers</CardTitle>
          <CardDescription>Largest absolute unrealised P&L.</CardDescription>
        </CardHeader>
        <CardContent>
          {topMovers.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              No movers yet. Add transactions to see action here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {topMovers.map((a) => (
                <li key={a.asset.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <Link
                    href={
                      a.asset.category === "real_estate"
                        ? `/real-estate/${a.asset.id}`
                        : `/assets/${a.asset.id}`
                    }
                    className="flex flex-1 items-center gap-3 hover:underline"
                  >
                    <Badge variant="muted">
                      {ASSET_CATEGORY_LABEL[a.asset.category as keyof typeof ASSET_CATEGORY_LABEL]}
                    </Badge>
                    <span className="font-medium">{a.asset.name}</span>
                  </Link>
                  <span className="tabular-nums text-text-muted">
                    {formatCurrency(a.marketValueEur)}
                  </span>
                  <ChangeBadge value={a.unrealizedPnlEur} base={a.costBasisEur} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function greeting() {
  const hours = new Date().getHours();
  if (hours < 12) return "Good morning";
  if (hours < 18) return "Good afternoon";
  return "Good evening";
}

function RefreshAllButton() {
  // Server-rendered placeholder — the dedicated refresh button on each asset
  // page handles individual ticker refresh. The full cron handler is at
  // /api/cron/snapshot.
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/assets">
        <RefreshCw className="size-4" />
        Manage prices
      </Link>
    </Button>
  );
}
