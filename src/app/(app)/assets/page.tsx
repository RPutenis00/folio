import Link from "next/link";
import { Plus } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-user";
import { getPortfolio } from "@/lib/db/queries";
import { ASSET_CATEGORY_LABEL, PRICED_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatQuantity } from "@/lib/utils";
import { ChangeBadge } from "@/components/change-badge";

export const metadata = { title: "Assets" };

export default async function AssetsPage() {
  const profile = await requireProfile();
  const portfolio = await getPortfolio(profile.id);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Holdings</p>
          <h1 className="font-display text-3xl">All assets</h1>
        </div>
        <Button asChild>
          <Link href="/assets/new">
            <Plus className="size-4" />
            New asset
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Cost basis</TableHead>
                <TableHead className="text-right">Value (EUR)</TableHead>
                <TableHead className="text-right">Unrealized</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio.assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-text-muted">
                    <div className="space-y-2">
                      <p>No assets yet.</p>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/assets/new">Add your first asset</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                portfolio.assets.map((v) => (
                  <TableRow key={v.asset.id}>
                    <TableCell>
                      <Link
                        href={
                          v.asset.category === "real_estate"
                            ? `/real-estate/${v.asset.id}`
                            : `/assets/${v.asset.id}`
                        }
                        className="font-medium hover:underline"
                      >
                        {v.asset.name}
                      </Link>
                      {v.asset.ticker ? (
                        <span className="ml-2 text-xs text-text-muted">{v.asset.ticker}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{ASSET_CATEGORY_LABEL[v.asset.category as keyof typeof ASSET_CATEGORY_LABEL]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-text-muted">
                      {PRICED_CATEGORIES.includes(v.asset.category as never)
                        ? formatQuantity(v.currentQuantity)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(v.costBasisEur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(v.marketValueEur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <ChangeBadge value={v.unrealizedPnlEur} base={v.costBasisEur} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
