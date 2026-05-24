import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-user";
import { getProperty } from "@/lib/db/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyForm } from "../../property-form";
import { DeletePropertyButton } from "./delete-property-button";

type PageProps = { params: Promise<{ id: string }> };

export const metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const data = await getProperty(profile.id, id);
  if (!data) notFound();

  const { asset, property } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/real-estate/${id}`}
        className="inline-flex items-center text-sm text-text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to property
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit property</CardTitle>
          <CardDescription>Update details. Use the &ldquo;Revalue&rdquo; button for current valuation.</CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyForm
            mode="edit"
            assetId={asset.id}
            defaultValues={{
              assetId: asset.id,
              name: asset.name,
              addressLine1: property.addressLine1,
              addressLine2: property.addressLine2 ?? "",
              city: property.city ?? "",
              country: property.country ?? "",
              postalCode: property.postalCode ?? "",
              purchaseDate: property.purchaseDate,
              purchasePrice: Number(property.purchasePrice),
              purchaseCurrency: property.purchaseCurrency as never,
              currentValuation: Number(property.currentValuation),
              valuationDate: property.valuationDate,
              beds: property.beds ?? null,
              baths: property.baths ?? null,
              sqm: property.sqm != null ? Number(property.sqm) : null,
              yearBuilt: property.yearBuilt ?? null,
              notes: property.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Deleting removes the property, all transactions, and scenarios.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeletePropertyButton assetId={asset.id} />
        </CardContent>
      </Card>
    </div>
  );
}
