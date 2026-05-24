import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-user";
import { getAssetWithPosition } from "@/lib/db/queries";
import { ASSET_CATEGORY_LABEL } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { KpiCard } from "@/components/kpi-card";
import { TransactionsTable } from "./transactions-table";
import { TransactionDialog } from "./transaction-dialog";
import { RefreshPriceButton } from "./refresh-price-button";
import { formatCurrency, formatQuantity } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const data = await getAssetWithPosition(profile.id, id);
  return { title: data?.asset.name ?? "Asset" };
}

export default async function AssetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const data = await getAssetWithPosition(profile.id, id);
  if (!data) notFound();

  if (data.asset.category === "real_estate") {
    redirect(`/real-estate/${id}`);
  }

  const { asset, txs, position, marketPrice, marketValueEur, unrealizedPnlEur } = data;

  return (
    <div className="space-y-8">
      <Link
        href="/assets"
        className="inline-flex items-center text-sm text-text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All assets
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge variant="muted">{ASSET_CATEGORY_LABEL[asset.category as keyof typeof ASSET_CATEGORY_LABEL]}</Badge>
            {asset.ticker ? (
              <span className="text-xs font-medium tracking-wider text-text-muted">
                {asset.ticker}
              </span>
            ) : null}
          </div>
          <h1 className="font-display text-3xl">{asset.name}</h1>
          {marketPrice ? (
            <p className="text-sm text-text-muted">
              Last price{" "}
              <span className="tabular-nums text-foreground">
                {formatCurrency(marketPrice.price, { currency: marketPrice.currency })}
              </span>
              {asset.ticker ? <RefreshPriceButton ticker={asset.ticker} category={asset.category} /> : null}
            </p>
          ) : null}
        </div>
        <TransactionDialog assetId={asset.id} assetCurrency={asset.currency} priced />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Quantity" value={formatQuantity(position.currentQuantity)} mono />
        <KpiCard label="Avg cost" value={formatCurrency(position.averageCostEur)} mono />
        <KpiCard label="Market value" value={formatCurrency(marketValueEur)} mono accent />
        <KpiCard
          label="Unrealized P&L"
          value={formatCurrency(unrealizedPnlEur, { signed: true })}
          mono
          tone={unrealizedPnlEur >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Realized P&L"
          value={formatCurrency(position.realizedPnlEur, { signed: true })}
          mono
          subtle
        />
        <KpiCard label="Dividends" value={formatCurrency(position.totalDividendsEur)} mono subtle />
        <KpiCard label="Fees paid" value={formatCurrency(position.totalFeesEur)} mono subtle />
      </div>

      <Separator />

      <Card>
        <CardHeader className="flex-row items-end justify-between">
          <CardTitle>Transactions</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`/assets/${asset.id}/edit`}>Edit asset</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <TransactionsTable transactions={txs} assetId={asset.id} priced />
        </CardContent>
      </Card>
    </div>
  );
}
