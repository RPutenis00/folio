import { z } from "zod";
import { ASSET_CATEGORIES, ISO_CURRENCIES } from "@/lib/constants";

export const createAssetSchema = z.object({
  category: z.enum(ASSET_CATEGORIES),
  name: z.string().min(1, "Name is required").max(120),
  ticker: z
    .string()
    .max(32)
    .transform((v) => (v ? v.toUpperCase().trim() : ""))
    .optional()
    .or(z.literal("")),
  currency: z.enum(ISO_CURRENCIES).default("EUR"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = createAssetSchema.extend({
  id: z.string().uuid(),
  status: z.enum(["active", "closed"]).default("active"),
});
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
