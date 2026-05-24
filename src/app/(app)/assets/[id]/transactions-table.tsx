"use client";

import * as React from "react";
import { toast } from "sonner";
import { Trash2, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "./transaction-dialog";
import {
  TRANSACTION_TYPE_LABEL,
  PROPERTY_EXPENSE_CATEGORY_LABEL,
  PROPERTY_INCOME_CATEGORY_LABEL,
} from "@/lib/constants";
import type { Transaction } from "@/lib/db/schema";
import { deleteTransactionAction } from "@/app/(app)/assets/actions";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/utils";

function categoryLabel(c?: string | null): string {
  if (!c) return "";
  if (c in PROPERTY_EXPENSE_CATEGORY_LABEL) {
    return PROPERTY_EXPENSE_CATEGORY_LABEL[c as keyof typeof PROPERTY_EXPENSE_CATEGORY_LABEL];
  }
  if (c in PROPERTY_INCOME_CATEGORY_LABEL) {
    return PROPERTY_INCOME_CATEGORY_LABEL[c as keyof typeof PROPERTY_INCOME_CATEGORY_LABEL];
  }
  return c;
}

export function TransactionsTable({
  transactions,
  assetId,
  priced = true,
}: {
  transactions: Transaction[];
  assetId: string;
  priced?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          {priced ? <TableHead className="text-right">Qty</TableHead> : null}
          {priced ? <TableHead className="text-right">Price</TableHead> : <TableHead>Category</TableHead>}
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Fees</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead aria-label="actions" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={priced ? 8 : 7} className="py-10 text-center text-text-muted">
              No transactions yet.
            </TableCell>
          </TableRow>
        ) : (
          transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="text-text-muted">{formatDate(t.occurredAt)}</TableCell>
              <TableCell>
                <Badge variant={typeTone(t.type)}>
                  {TRANSACTION_TYPE_LABEL[t.type as keyof typeof TRANSACTION_TYPE_LABEL] ?? t.type}
                </Badge>
              </TableCell>
              {priced ? (
                <TableCell className="text-right tabular-nums">{formatQuantity(toNum(t.quantity))}</TableCell>
              ) : null}
              {priced ? (
                <TableCell className="text-right tabular-nums text-text-muted">
                  {t.unitPrice
                    ? formatCurrency(toNum(t.unitPrice), { currency: t.currency })
                    : "—"}
                </TableCell>
              ) : (
                <TableCell className="text-text-muted">{categoryLabel(t.category)}</TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                {formatCurrency(toNum(t.totalAmount), { currency: t.currency })}
              </TableCell>
              <TableCell className="text-right tabular-nums text-text-muted">
                {Number(t.fees) > 0
                  ? formatCurrency(toNum(t.fees), { currency: t.currency })
                  : "—"}
              </TableCell>
              <TableCell className="max-w-[18ch] truncate text-text-muted">{t.notes ?? ""}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <TransactionDialog
                    assetId={assetId}
                    assetCurrency={t.currency}
                    priced={priced}
                    transaction={t}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit">
                        <Pencil className="size-4 text-text-muted" />
                      </Button>
                    }
                  />
                  <DeleteButton id={t.id} assetId={assetId} />
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function DeleteButton({ id, assetId }: { id: string; assetId: string }) {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Delete"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Delete this transaction?")) return;
        setPending(true);
        const r = await deleteTransactionAction(id, assetId);
        setPending(false);
        if (r.ok) toast.success("Transaction deleted.");
        else toast.error(r.error);
      }}
    >
      <Trash2 className="size-4 text-text-muted" />
    </Button>
  );
}

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function typeTone(t: string): "success" | "destructive" | "muted" | "accent" | "default" {
  if (t === "buy" || t === "transfer_in" || t === "dividend" || t === "income") return "success";
  if (t === "sell" || t === "transfer_out" || t === "expense" || t === "fee") return "destructive";
  if (t === "valuation") return "accent";
  return "muted";
}
