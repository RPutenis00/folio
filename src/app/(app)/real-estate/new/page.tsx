import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PropertyForm } from "../property-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Add property" };

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/real-estate"
        className="inline-flex items-center text-sm text-text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All properties
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Add property</CardTitle>
          <CardDescription>
            The purchase price is logged as an initial expense. You can add renovations,
            mortgage, rent, etc. on the property page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
