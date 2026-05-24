import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-user";
import { listUserProperties } from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Real estate" };

export default async function RealEstatePage() {
  const profile = await requireProfile();
  const rows = await listUserProperties(profile.id);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Properties</p>
          <h1 className="font-display text-3xl">Real estate</h1>
        </div>
        <Button asChild>
          <Link href="/real-estate/new">
            <Plus className="size-4" />
            Add property
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-text-muted">No properties yet.</p>
            <Button asChild variant="outline">
              <Link href="/real-estate/new">Add your first property</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ asset, property }) => (
            <li key={asset.id}>
              <Link
                href={`/real-estate/${asset.id}`}
                className="block rounded-xl border border-border bg-card transition-colors hover:border-border-strong"
              >
                <div className="aspect-[16/9] rounded-t-xl bg-surface-strong" aria-hidden />
                <div className="space-y-2 p-5">
                  <h3 className="text-lg font-medium">{asset.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-text-muted">
                    <MapPin className="size-3" />
                    {[property.city, property.country].filter(Boolean).join(", ") || property.addressLine1}
                  </p>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs uppercase tracking-[0.06em] text-text-muted">Value</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(Number(property.currentValuation), {
                        currency: property.purchaseCurrency,
                      })}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-text-muted">
                    <span>Last valued</span>
                    <span>{formatDate(property.valuationDate)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
