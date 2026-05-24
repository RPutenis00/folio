import { z } from "zod";
import {
  ISO_CURRENCIES,
  PROPERTY_EXPENSE_CATEGORIES,
  PROPERTY_INCOME_CATEGORIES,
  TRANSACTION_TYPES,
} from "@/lib/constants";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const transactionInputSchema = z.object({
  assetId: z.string().uuid(),
  type: z.enum(TRANSACTION_TYPES),
  occurredAt: dateString,
  quantity: z.coerce.number().nonnegative().optional().nullable(),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
  totalAmount: z.coerce.number(),
  fees: z.coerce.number().nonnegative().default(0),
  currency: z.enum(ISO_CURRENCIES),
  category: z
    .union([z.enum(PROPERTY_EXPENSE_CATEGORIES), z.enum(PROPERTY_INCOME_CATEGORIES)])
    .optional()
    .nullable(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const updateTransactionSchema = transactionInputSchema.extend({
  id: z.string().uuid(),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
