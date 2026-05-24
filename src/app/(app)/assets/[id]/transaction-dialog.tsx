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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ISO_CURRENCIES,
  PROPERTY_EXPENSE_CATEGORIES,
  PROPERTY_EXPENSE_CATEGORY_LABEL,
  PROPERTY_INCOME_CATEGORIES,
  PROPERTY_INCOME_CATEGORY_LABEL,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABEL,
  type IsoCurrency,
  type TransactionType,
} from "@/lib/constants";
import {
  transactionInputSchema,
  type TransactionInput,
} from "@/lib/validators/transaction";
import {
  createTransactionAction,
  updateTransactionAction,
} from "@/app/(app)/assets/actions";
import type { Transaction } from "@/lib/db/schema";

type Mode = "create" | "edit";

const today = () => new Date().toISOString().slice(0, 10);

const PRICED_TYPES: TransactionType[] = ["buy", "sell", "dividend", "fee", "transfer_in", "transfer_out"];
const PROPERTY_TYPES: TransactionType[] = ["expense", "income", "valuation"];

export function TransactionDialog({
  assetId,
  assetCurrency,
  priced,
  transaction,
  trigger,
}: {
  assetId: string;
  assetCurrency: string;
  priced: boolean;
  transaction?: Transaction;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const mode: Mode = transaction ? "edit" : "create";

  const initialType: TransactionType = transaction
    ? (transaction.type as TransactionType)
    : priced
      ? "buy"
      : "expense";

  const initialCurrency: IsoCurrency = (transaction?.currency as IsoCurrency) ?? (assetCurrency as IsoCurrency) ?? "EUR";

  const form = useForm<TransactionInput>({
    resolver: zodResolver(transactionInputSchema),
    defaultValues: {
      assetId,
      type: initialType,
      occurredAt: transaction?.occurredAt ?? today(),
      quantity: transaction?.quantity != null ? Number(transaction.quantity) : null,
      unitPrice: transaction?.unitPrice != null ? Number(transaction.unitPrice) : null,
      totalAmount: transaction?.totalAmount != null ? Number(transaction.totalAmount) : 0,
      fees: transaction?.fees != null ? Number(transaction.fees) : 0,
      currency: initialCurrency,
      category: (transaction?.category as TransactionInput["category"]) ?? null,
      notes: transaction?.notes ?? "",
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting, errors },
  } = form;

  const type = watch("type");
  const quantity = watch("quantity");
  const unitPrice = watch("unitPrice");

  // Auto-compute total = qty * price for buy/sell unless user has typed
  // a value manually.
  const userTouchedTotal = React.useRef(false);
  React.useEffect(() => {
    if (userTouchedTotal.current) return;
    if (type === "buy" || type === "sell") {
      const q = Number(quantity);
      const p = Number(unitPrice);
      if (Number.isFinite(q) && Number.isFinite(p) && q > 0 && p > 0) {
        setValue("totalAmount", Math.round(q * p * 10000) / 10000, { shouldValidate: true });
      }
    }
  }, [type, quantity, unitPrice, setValue]);

  React.useEffect(() => {
    if (!open) {
      reset();
      userTouchedTotal.current = false;
    }
  }, [open, reset]);

  const visibleTypes = priced ? PRICED_TYPES : PROPERTY_TYPES;
  const showQty = type === "buy" || type === "sell";
  const showCategory = !priced && (type === "expense" || type === "income");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> New transaction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New transaction" : "Edit transaction"}</DialogTitle>
          <DialogDescription>
            FX to EUR is locked in at the date you choose.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={handleSubmit(async (data) => {
            const payload = { ...data, assetId };
            const r =
              mode === "create"
                ? await createTransactionAction(payload)
                : await updateTransactionAction({ ...payload, id: transaction!.id });
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            toast.success(mode === "create" ? "Transaction added." : "Transaction updated.");
            setOpen(false);
          })}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setValue("type", v as TransactionType, { shouldValidate: true })}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.filter((t) => visibleTypes.includes(t)).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRANSACTION_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="occurredAt">Date</Label>
              <Input id="occurredAt" type="date" {...register("occurredAt")} />
            </div>
          </div>

          {showQty ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" step="any" min="0" {...register("quantity")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="unitPrice">Unit price</Label>
                <Input id="unitPrice" type="number" step="any" min="0" {...register("unitPrice")} />
              </div>
            </div>
          ) : null}

          {showCategory ? (
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                value={watch("category") ?? ""}
                onValueChange={(v) => setValue("category", v as TransactionInput["category"], { shouldValidate: true })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {type === "expense"
                    ? PROPERTY_EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {PROPERTY_EXPENSE_CATEGORY_LABEL[c]}
                        </SelectItem>
                      ))
                    : PROPERTY_INCOME_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {PROPERTY_INCOME_CATEGORY_LABEL[c]}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="totalAmount">Total amount</Label>
              <Input
                id="totalAmount"
                type="number"
                step="any"
                {...register("totalAmount", {
                  onChange: () => {
                    userTouchedTotal.current = true;
                  },
                })}
              />
              {errors.totalAmount ? (
                <p className="text-xs text-destructive">{errors.totalAmount.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={watch("currency")}
                onValueChange={(v) =>
                  setValue("currency", v as TransactionInput["currency"], { shouldValidate: true })
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="fees">Fees</Label>
              <Input id="fees" type="number" step="any" min="0" {...register("fees")} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : mode === "create" ? "Save transaction" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
