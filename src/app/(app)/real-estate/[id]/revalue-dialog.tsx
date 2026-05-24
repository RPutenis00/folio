"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { revaluePropertyAction } from "../actions";
import { revaluationSchema } from "@/lib/validators/property";

type RevalueForm = z.infer<typeof revaluationSchema>;

export function RevalueDialog({
  assetId,
  currentValuation,
  valuationDate,
}: {
  assetId: string;
  currentValuation: number;
  valuationDate: string;
}) {
  const [open, setOpen] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<RevalueForm>({
    resolver: zodResolver(revaluationSchema),
    defaultValues: {
      assetId,
      currentValuation,
      valuationDate: today.slice(0, 10) > valuationDate ? today : valuationDate,
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Scale className="size-4" />
          Revalue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revalue property</DialogTitle>
          <DialogDescription>
            Update the current valuation. We&apos;ll also log a valuation event so the history is preserved.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={handleSubmit(async (data) => {
            const r = await revaluePropertyAction(data);
            if (!r.ok) toast.error(r.error);
            else {
              toast.success("Property revalued.");
              setOpen(false);
            }
          })}
        >
          <input type="hidden" {...register("assetId")} />
          <div className="grid gap-2">
            <Label htmlFor="currentValuation">New valuation</Label>
            <Input
              id="currentValuation"
              type="number"
              step="any"
              min="0"
              {...register("currentValuation")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="valuationDate">As of</Label>
            <Input id="valuationDate" type="date" {...register("valuationDate")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
