"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateAssetSchema, type UpdateAssetInput } from "@/lib/validators/asset";
import { deleteAssetAction, updateAssetAction } from "../../actions";
import { ISO_CURRENCIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Asset } from "@/lib/db/schema";

export function EditAssetForm({ asset }: { asset: Asset }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<UpdateAssetInput>({
    resolver: zodResolver(updateAssetSchema),
    defaultValues: {
      id: asset.id,
      category: asset.category as UpdateAssetInput["category"],
      name: asset.name,
      ticker: asset.ticker ?? "",
      currency: asset.currency as UpdateAssetInput["currency"],
      status: (asset.status as UpdateAssetInput["status"]) ?? "active",
      notes: "",
    },
  });

  return (
    <form
      className="grid gap-5"
      onSubmit={handleSubmit(async (data) => {
        const r = await updateAssetAction(data);
        if (!r.ok) toast.error(r.error);
        else {
          toast.success("Asset updated.");
          router.push(`/assets/${asset.id}`);
        }
      })}
    >
      <input type="hidden" {...register("id")} />
      <input type="hidden" {...register("category")} />

      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ticker">Ticker</Label>
          <Input id="ticker" {...register("ticker")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={watch("currency")}
            onValueChange={(v) =>
              setValue("currency", v as UpdateAssetInput["currency"], { shouldValidate: true })
            }
          >
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISO_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={watch("status")}
          onValueChange={(v) =>
            setValue("status", v as UpdateAssetInput["status"], { shouldValidate: true })
          }
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <DeleteAssetButton id={asset.id} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function DeleteAssetButton({ id }: { id: string }) {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Delete this asset and all of its transactions? This can't be undone.")) {
          return;
        }
        setPending(true);
        try {
          await deleteAssetAction(id);
        } catch {
          // server action redirects on success; only error path runs cleanup
          setPending(false);
        }
      }}
    >
      Delete asset
    </Button>
  );
}
