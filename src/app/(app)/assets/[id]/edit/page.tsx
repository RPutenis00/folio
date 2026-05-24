import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth/current-user";
import { getAsset } from "@/lib/db/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditAssetForm } from "./edit-asset-form";

type PageProps = { params: Promise<{ id: string }> };

export const metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const asset = await getAsset(profile.id, id);
  if (!asset) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/assets/${id}`}
        className="inline-flex items-center text-sm text-text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit asset</CardTitle>
          <CardDescription>Rename, change ticker, or archive.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditAssetForm asset={asset} />
        </CardContent>
      </Card>
    </div>
  );
}
