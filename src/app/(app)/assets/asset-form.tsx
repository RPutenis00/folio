"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createAssetSchema, type CreateAssetInput } from "@/lib/validators/asset";
import { createAssetAction } from "./actions";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  ISO_CURRENCIES,
  type AssetCategory,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

const SELECTABLE: AssetCategory[] = ["stock", "etf", "fund", "crypto", "cash", "bond", "other"];

export function AssetForm({ initialCategory }: { initialCategory?: AssetCategory }) {
  const router = useRouter();
  const {
    register,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssetInput>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: {
      category: initialCategory ?? "stock",
      currency: "EUR",
      ticker: "",
      notes: "",
    },
  });

  const category = watch("category");

  return (
    <form
      className="grid gap-5"
      onSubmit={handleSubmit(async (data) => {
        const result = await createAssetAction(data);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Asset created.");
        router.push(`/assets/${result.data!.id}`);
      })}
    >
      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={category}
          onValueChange={(v) => setValue("category", v as AssetCategory, { shouldValidate: true })}
        >
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SELECTABLE.map((c) => (
              <SelectItem key={c} value={c}>
                {ASSET_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Apple Inc." {...register("name")} />
        {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ticker">Ticker</Label>
          <Input id="ticker" placeholder={category === "crypto" ? "BTC" : "AAPL"} {...register("ticker")} />
          {errors.ticker ? <FieldError>{errors.ticker.message}</FieldError> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={watch("currency")}
            onValueChange={(v) => setValue("currency", v as CreateAssetInput["currency"], { shouldValidate: true })}
          >
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CATEGORIES.length > 0 &&
                ISO_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} placeholder="Optional — e.g. broker, holding rationale" {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Create asset"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive">{children}</p>;
}
