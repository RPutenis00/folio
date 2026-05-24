import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-user";
import { getProperty, listAssetTransactions, listScenarios } from "@/lib/db/queries";
import { deriveLots } from "@/lib/finance/cost-basis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/kpi-card";
import { TransactionDialog } from "@/app/(app)/assets/[id]/transaction-dialog";
import { TransactionsTable } from "@/app/(app)/assets/[id]/transactions-table";
import { RevalueDialog } from "./revalue-dialog";
import { ScenariosSection } from "./scenarios-section";
import { ScenarioComparison } from "./scenario-comparison";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PROPERTY_EXPENSE_CATEGORY_LABEL,
  PROPERTY_EXPENSE_CATEGORIES,
} from "@/lib/constants";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const data = await getProperty(profile.id, id);
  return { title: data?.asset.name ?? "Property" };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const data = await getProperty(profile.id, id);
  if (!data) notFound();

  const { asset, property } = data;
  const txs = await listAssetTransactions(profile.id, asset.id);
  const scenarios = await listScenarios(asset.id);

  // Cash-flow rollups in EUR.
  const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
  const totalCashInvested = txs
    .filter((t) => t.type === "expense" && PROPERTY_EXPENSE_CATEGORIES.includes((t.category ?? "") as never))
    .reduce((s, t) => s + num(t.totalAmount) * num(t.fxRateToEur), 0);
  const totalIncome = txs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + num(t.totalAmount) * num(t.fxRateToEur), 0);
  const totalExpenses = txs
    .filter((t) => t.type === "expense" && t.category !== "purchase_cost")
    .reduce((s, t) => s + num(t.totalAmount) * num(t.fxRateToEur), 0);
  const netCashFlow = totalIncome - totalExpenses;

  // Expense breakdown by category.
  const byCategory = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.category) continue;
    const eur = num(t.totalAmount) * num(t.fxRateToEur);
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + eur);
  }
  const expenseRows = Array.from(byCategory.entries())
    .map(([cat, amount]) => ({ cat, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Property current valuation in EUR (uses latest tx fx as proxy).
  const lastFx = txs.at(-1)?.fxRateToEur ? Number(txs.at(-1)!.fxRateToEur) : 1;
  const currentValuationEur =
    num(property.currentValuation) * (property.purchaseCurrency === "EUR" ? 1 : lastFx);

  return (
    <div className="space-y-8">
      <Link
        href="/real-estate"
        className="inline-flex items-center text-sm text-text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All properties
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-3xl">{asset.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-text-muted">
            <MapPin className="size-3.5" />
            {[property.addressLine1, property.city, property.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="flex gap-2">
          <RevalueDialog
            assetId={asset.id}
            currentValuation={Number(property.currentValuation)}
            valuationDate={property.valuationDate}
          />
          <Button asChild variant="outline">
            <Link href={`/real-estate/${asset.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Current valuation"
          value={formatCurrency(currentValuationEur)}
          hint={`Set ${formatDate(property.valuationDate)}`}
          mono
          accent
        />
        <KpiCard label="Cash invested" value={formatCurrency(totalCashInvested)} mono />
        <KpiCard
          label="Net cash flow"
          value={formatCurrency(netCashFlow, { signed: true })}
          mono
          tone={netCashFlow >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Equity (val − invested)"
          value={formatCurrency(currentValuationEur - totalCashInvested, { signed: true })}
          mono
        />
      </div>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="breakdown">Expense breakdown</TabsTrigger>
          <TabsTrigger value="scenarios">Rental scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex-row items-end justify-between">
              <div>
                <CardTitle>Ledger</CardTitle>
                <CardDescription>Every income and expense for this property.</CardDescription>
              </div>
              <TransactionDialog
                assetId={asset.id}
                assetCurrency={property.purchaseCurrency}
                priced={false}
              />
            </CardHeader>
            <CardContent className="p-0">
              <TransactionsTable transactions={txs} assetId={asset.id} priced={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by category</CardTitle>
              <CardDescription>Lifetime totals in EUR.</CardDescription>
            </CardHeader>
            <CardContent>
              {expenseRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">No expenses logged yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {expenseRows.map((row) => (
                    <li key={row.cat} className="flex items-center justify-between py-3 text-sm">
                      <span>
                        {PROPERTY_EXPENSE_CATEGORY_LABEL[
                          row.cat as keyof typeof PROPERTY_EXPENSE_CATEGORY_LABEL
                        ] ?? row.cat}
                      </span>
                      <span className="font-mono tabular-nums">{formatCurrency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <ScenarioComparison
            scenarios={scenarios}
            propertyValueEur={currentValuationEur}
            totalCashInvestedEur={totalCashInvested}
          />
          <Separator />
          <ScenariosSection
            propertyId={asset.id}
            scenarios={scenarios}
            propertyValueEur={currentValuationEur}
            totalCashInvestedEur={totalCashInvested}
          />
        </TabsContent>
      </Tabs>

      {/* Side note: derived position is irrelevant here (qty/price not applicable). */}
      <details className="text-xs text-text-subtle">
        <summary className="cursor-pointer text-text-muted">Position debug</summary>
        <pre className="mt-2 overflow-auto rounded-md bg-surface-muted p-3">
          {JSON.stringify(
            deriveLots(
              txs.map((t) => ({
                type: t.type as never,
                quantity: t.quantity != null ? Number(t.quantity) : null,
                unitPrice: t.unitPrice != null ? Number(t.unitPrice) : null,
                totalAmount: Number(t.totalAmount),
                fees: Number(t.fees),
                fxRateToEur: Number(t.fxRateToEur),
                occurredAt: t.occurredAt,
              })),
            ),
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
