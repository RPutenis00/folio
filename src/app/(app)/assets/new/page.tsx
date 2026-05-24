import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssetForm } from "../asset-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New asset" };

export default function NewAssetPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/assets" className="inline-flex items-center text-sm text-text-muted hover:text-foreground">
        <ChevronLeft className="size-4" /> All assets
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New asset</CardTitle>
          <CardDescription>
            Stocks, ETFs, funds, and crypto get prices auto-fetched. Real-estate properties have
            their own form — use <Link href="/real-estate/new" className="underline">Add property</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssetForm />
        </CardContent>
      </Card>
    </div>
  );
}
