"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  propertyInputSchema,
  updatePropertySchema,
  type PropertyInput,
  type UpdatePropertyInput,
} from "@/lib/validators/property";
import { createPropertyAction, updatePropertyAction } from "./actions";
import { ISO_CURRENCIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ModeProps =
  | { mode: "create" }
  | { mode: "edit"; assetId: string; defaultValues: Partial<UpdatePropertyInput> };

const today = () => new Date().toISOString().slice(0, 10);

export function PropertyForm(props: ModeProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const schema = isEdit ? updatePropertySchema : propertyInputSchema;
  type FormValues = PropertyInput & { assetId?: string };

  const defaults: FormValues = isEdit
    ? ({
        ...props.defaultValues,
      } as FormValues)
    : {
        name: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        country: "",
        postalCode: "",
        purchaseDate: today(),
        purchasePrice: 0,
        purchaseCurrency: "EUR",
        currentValuation: 0,
        valuationDate: today(),
        beds: null,
        baths: null,
        sqm: null,
        yearBuilt: null,
        notes: "",
      };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  return (
    <form
      className="grid gap-6"
      onSubmit={handleSubmit(async (data) => {
        const r = isEdit
          ? await updatePropertyAction({ ...data, assetId: (props as Extract<ModeProps, { mode: "edit" }>).assetId })
          : await createPropertyAction(data);
        if (!r.ok) toast.error(r.error);
        else {
          toast.success(isEdit ? "Property updated." : "Property added.");
          router.push(isEdit ? `/real-estate/${(props as Extract<ModeProps, { mode: "edit" }>).assetId}` : `/real-estate/${r.data!.id}`);
        }
      })}
    >
      <Section title="Identity">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder='e.g. "Sunset Apt 3B"' {...register("name")} />
        </div>
      </Section>

      <Section title="Address">
        <div className="grid gap-2">
          <Label htmlFor="addressLine1">Street</Label>
          <Input id="addressLine1" {...register("addressLine1")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register("city")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register("country")} />
          </div>
        </div>
      </Section>

      <Section title="Purchase & valuation">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="purchaseDate">Purchase date</Label>
            <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="purchaseCurrency">Currency</Label>
            <Select
              value={watch("purchaseCurrency")}
              onValueChange={(v) =>
                setValue("purchaseCurrency", v as PropertyInput["purchaseCurrency"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="purchaseCurrency">
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
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="purchasePrice">Purchase price</Label>
            <Input id="purchasePrice" type="number" step="any" min="0" {...register("purchasePrice")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="currentValuation">Current valuation</Label>
            <Input id="currentValuation" type="number" step="any" min="0" {...register("currentValuation")} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="valuationDate">Last valued</Label>
          <Input id="valuationDate" type="date" {...register("valuationDate")} />
        </div>
      </Section>

      <Section title="Details (optional)">
        <div className="grid grid-cols-4 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="beds">Beds</Label>
            <Input id="beds" type="number" min="0" {...register("beds")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="baths">Baths</Label>
            <Input id="baths" type="number" min="0" {...register("baths")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sqm">Size (m²)</Label>
            <Input id="sqm" type="number" step="any" min="0" {...register("sqm")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="yearBuilt">Year built</Label>
            <Input id="yearBuilt" type="number" {...register("yearBuilt")} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add property"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-border pt-5 first:border-0 first:pt-0">
      <legend className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
