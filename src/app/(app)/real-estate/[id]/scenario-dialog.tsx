"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RENTAL_STRATEGIES,
  RENTAL_STRATEGY_LABEL,
  type RentalStrategy,
} from "@/lib/constants";
import {
  scenarioInputSchema,
  type ScenarioInputForm,
} from "@/lib/validators/property";
import { createScenarioAction, updateScenarioAction } from "../actions";
import type { RentalScenario } from "@/lib/db/schema";

export function ScenarioDialog({
  propertyId,
  scenario,
  trigger,
}: {
  propertyId: string;
  scenario?: RentalScenario;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const mode = scenario ? "edit" : "create";

  const defaults: ScenarioInputForm = {
    propertyId,
    name: scenario?.name ?? "",
    strategy: (scenario?.strategy as RentalStrategy) ?? "LTR",
    isCurrent: scenario?.isCurrent ?? false,
    monthlyRent: scenario?.monthlyRent != null ? Number(scenario.monthlyRent) : null,
    ltrMonthsPerYear: scenario?.ltrMonthsPerYear ?? null,
    nightlyRate: scenario?.nightlyRate != null ? Number(scenario.nightlyRate) : null,
    occupancyPct: scenario?.occupancyPct != null ? Number(scenario.occupancyPct) : null,
    cleaningFeePerStay:
      scenario?.cleaningFeePerStay != null ? Number(scenario.cleaningFeePerStay) : 0,
    avgStayNights: scenario?.avgStayNights != null ? Number(scenario.avgStayNights) : null,
    platformFeePct: scenario?.platformFeePct != null ? Number(scenario.platformFeePct) : 0,
    managementFeePct:
      scenario?.managementFeePct != null ? Number(scenario.managementFeePct) : 0,
    monthlyOpex: scenario?.monthlyOpex != null ? Number(scenario.monthlyOpex) : 0,
    vacancyPct: scenario?.vacancyPct != null ? Number(scenario.vacancyPct) : 0,
    notes: scenario?.notes ?? "",
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<ScenarioInputForm>({
    resolver: zodResolver(scenarioInputSchema),
    defaultValues: defaults,
  });

  const strategy = watch("strategy");
  const showLtr = strategy === "LTR" || strategy === "HYBRID";
  const showStr = strategy === "STR" || strategy === "HYBRID";

  React.useEffect(() => {
    if (!open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Plus className="size-4" /> New scenario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New scenario" : "Edit scenario"}</DialogTitle>
          <DialogDescription>Define rental assumptions to compute yields and cash flow.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={handleSubmit(async (data) => {
            const r =
              mode === "create"
                ? await createScenarioAction({ ...data, propertyId })
                : await updateScenarioAction({ ...data, id: scenario!.id, propertyId });
            if (!r.ok) toast.error(r.error);
            else {
              toast.success(mode === "create" ? "Scenario added." : "Scenario updated.");
              setOpen(false);
            }
          })}
        >
          <input type="hidden" {...register("propertyId")} />

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. STR — summer focus" {...register("name")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="strategy">Strategy</Label>
              <Select
                value={strategy}
                onValueChange={(v) => setValue("strategy", v as RentalStrategy, { shouldValidate: true })}
              >
                <SelectTrigger id="strategy"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RENTAL_STRATEGIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RENTAL_STRATEGY_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showLtr ? (
            <fieldset className="grid gap-3 rounded-md border border-border p-4">
              <legend className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
                Long-term
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="monthlyRent">Monthly rent (EUR)</Label>
                  <Input id="monthlyRent" type="number" step="any" min="0" {...register("monthlyRent")} />
                  {errors.monthlyRent ? (
                    <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="vacancyPct">Vacancy %</Label>
                  <Input id="vacancyPct" type="number" step="any" min="0" max="100" {...register("vacancyPct")} />
                </div>
              </div>
              {strategy === "HYBRID" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="ltrMonthsPerYear">LTR months / year</Label>
                  <Input id="ltrMonthsPerYear" type="number" min="0" max="12" {...register("ltrMonthsPerYear")} />
                </div>
              ) : null}
            </fieldset>
          ) : null}

          {showStr ? (
            <fieldset className="grid gap-3 rounded-md border border-border p-4">
              <legend className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
                Short-term
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="nightlyRate">Nightly rate (EUR)</Label>
                  <Input id="nightlyRate" type="number" step="any" min="0" {...register("nightlyRate")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="occupancyPct">Occupancy %</Label>
                  <Input id="occupancyPct" type="number" step="any" min="0" max="100" {...register("occupancyPct")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="avgStayNights">Avg stay (nights)</Label>
                  <Input id="avgStayNights" type="number" step="any" min="1" {...register("avgStayNights")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cleaningFeePerStay">Cleaning fee</Label>
                  <Input id="cleaningFeePerStay" type="number" step="any" min="0" {...register("cleaningFeePerStay")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="platformFeePct">Platform fee %</Label>
                  <Input id="platformFeePct" type="number" step="any" min="0" max="100" {...register("platformFeePct")} />
                </div>
              </div>
            </fieldset>
          ) : null}

          <fieldset className="grid gap-3 rounded-md border border-border p-4">
            <legend className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
              Operating costs
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="monthlyOpex">Monthly OPEX (EUR)</Label>
                <Input id="monthlyOpex" type="number" step="any" min="0" {...register("monthlyOpex")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="managementFeePct">Management fee %</Label>
                <Input id="managementFeePct" type="number" step="any" min="0" max="100" {...register("managementFeePct")} />
              </div>
            </div>
          </fieldset>

          <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
            <Checkbox
              checked={watch("isCurrent")}
              onCheckedChange={(c) => setValue("isCurrent", Boolean(c))}
            />
            <span>Set as current strategy for this property</span>
          </label>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : mode === "create" ? "Save scenario" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
