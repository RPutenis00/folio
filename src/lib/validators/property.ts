import { z } from "zod";
import { ISO_CURRENCIES, RENTAL_STRATEGIES } from "@/lib/constants";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const propertyInputSchema = z.object({
  name: z.string().min(1).max(160),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  country: z.string().max(120).optional().or(z.literal("")),
  postalCode: z.string().max(40).optional().or(z.literal("")),
  purchaseDate: dateString,
  purchasePrice: z.coerce.number().nonnegative(),
  purchaseCurrency: z.enum(ISO_CURRENCIES),
  currentValuation: z.coerce.number().nonnegative(),
  valuationDate: dateString,
  beds: z.coerce.number().int().nonnegative().optional().nullable(),
  baths: z.coerce.number().int().nonnegative().optional().nullable(),
  sqm: z.coerce.number().nonnegative().optional().nullable(),
  yearBuilt: z.coerce.number().int().min(1500).max(3000).optional().nullable(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type PropertyInput = z.infer<typeof propertyInputSchema>;

export const updatePropertySchema = propertyInputSchema.extend({
  assetId: z.string().uuid(),
});
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export const revaluationSchema = z.object({
  assetId: z.string().uuid(),
  currentValuation: z.coerce.number().nonnegative(),
  valuationDate: dateString,
});

export const scenarioInputSchema = z
  .object({
    propertyId: z.string().uuid(),
    name: z.string().min(1).max(120),
    strategy: z.enum(RENTAL_STRATEGIES),
    isCurrent: z.boolean().default(false),
    monthlyRent: z.coerce.number().nonnegative().optional().nullable(),
    ltrMonthsPerYear: z.coerce.number().int().min(0).max(12).optional().nullable(),
    nightlyRate: z.coerce.number().nonnegative().optional().nullable(),
    occupancyPct: z.coerce.number().min(0).max(100).optional().nullable(),
    cleaningFeePerStay: z.coerce.number().nonnegative().default(0),
    avgStayNights: z.coerce.number().positive().optional().nullable(),
    platformFeePct: z.coerce.number().min(0).max(100).default(0),
    managementFeePct: z.coerce.number().min(0).max(100).default(0),
    monthlyOpex: z.coerce.number().nonnegative().default(0),
    vacancyPct: z.coerce.number().min(0).max(100).default(0),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.strategy === "LTR" || data.strategy === "HYBRID") {
      if (data.monthlyRent == null) {
        ctx.addIssue({
          code: "custom",
          path: ["monthlyRent"],
          message: "Monthly rent is required for LTR/Hybrid",
        });
      }
    }
    if (data.strategy === "STR" || data.strategy === "HYBRID") {
      if (data.nightlyRate == null) {
        ctx.addIssue({
          code: "custom",
          path: ["nightlyRate"],
          message: "Nightly rate is required for STR/Hybrid",
        });
      }
      if (data.occupancyPct == null) {
        ctx.addIssue({
          code: "custom",
          path: ["occupancyPct"],
          message: "Occupancy % is required for STR/Hybrid",
        });
      }
    }
  });
export type ScenarioInputForm = z.infer<typeof scenarioInputSchema>;

export const updateScenarioSchema = scenarioInputSchema.and(
  z.object({ id: z.string().uuid() }),
);
