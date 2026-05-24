"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/current-user";
import {
  propertyInputSchema,
  revaluationSchema,
  scenarioInputSchema,
  updatePropertySchema,
  updateScenarioSchema,
} from "@/lib/validators/property";
import { fetchEurFxRate } from "@/lib/pricing/frankfurter";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/* ----------------------------- Properties ----------------------------- */

export async function createPropertyAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = propertyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const d = parsed.data;

  // FX at purchase date for the seed purchase transaction.
  let fx = 1;
  try {
    fx = await fetchEurFxRate(d.purchaseCurrency, new Date(d.purchaseDate));
  } catch {
    fx = 1;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(schema.assets)
        .values({
          userId: profile.id,
          category: "real_estate",
          name: d.name,
          ticker: null,
          currency: d.purchaseCurrency,
        })
        .returning({ id: schema.assets.id });

      await tx.insert(schema.properties).values({
        assetId: asset!.id,
        addressLine1: d.addressLine1,
        addressLine2: d.addressLine2 || null,
        city: d.city || null,
        country: d.country || null,
        postalCode: d.postalCode || null,
        purchaseDate: d.purchaseDate,
        purchasePrice: String(d.purchasePrice),
        purchaseCurrency: d.purchaseCurrency,
        currentValuation: String(d.currentValuation),
        valuationDate: d.valuationDate,
        beds: d.beds ?? null,
        baths: d.baths ?? null,
        sqm: d.sqm != null ? String(d.sqm) : null,
        yearBuilt: d.yearBuilt ?? null,
        notes: d.notes || null,
      });

      // Seed the purchase as an "expense" transaction with category=purchase_cost
      // so the ledger reflects total cash invested.
      await tx.insert(schema.transactions).values({
        userId: profile.id,
        assetId: asset!.id,
        type: "expense",
        occurredAt: d.purchaseDate,
        totalAmount: String(d.purchasePrice),
        fees: "0",
        currency: d.purchaseCurrency,
        fxRateToEur: String(fx),
        category: "purchase_cost",
        notes: "Initial purchase",
      });

      return asset!.id;
    });

    revalidatePath("/real-estate");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: result } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create property" };
  }
}

export async function updatePropertyAction(input: unknown): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = updatePropertySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const d = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.assets)
      .set({ name: d.name, currency: d.purchaseCurrency, updatedAt: new Date() })
      .where(and(eq(schema.assets.id, d.assetId), eq(schema.assets.userId, profile.id)));

    await tx
      .update(schema.properties)
      .set({
        addressLine1: d.addressLine1,
        addressLine2: d.addressLine2 || null,
        city: d.city || null,
        country: d.country || null,
        postalCode: d.postalCode || null,
        purchaseDate: d.purchaseDate,
        purchasePrice: String(d.purchasePrice),
        purchaseCurrency: d.purchaseCurrency,
        currentValuation: String(d.currentValuation),
        valuationDate: d.valuationDate,
        beds: d.beds ?? null,
        baths: d.baths ?? null,
        sqm: d.sqm != null ? String(d.sqm) : null,
        yearBuilt: d.yearBuilt ?? null,
        notes: d.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.assetId, d.assetId));
  });

  revalidatePath("/real-estate");
  revalidatePath(`/real-estate/${d.assetId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePropertyAction(assetId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  await db
    .delete(schema.assets)
    .where(and(eq(schema.assets.id, assetId), eq(schema.assets.userId, profile.id)));
  revalidatePath("/real-estate");
  revalidatePath("/dashboard");
  redirect("/real-estate");
}

export async function revaluePropertyAction(input: unknown): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = revaluationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  // Confirm ownership via assets table; properties RLS would also block.
  const [asset] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, parsed.data.assetId), eq(schema.assets.userId, profile.id)))
    .limit(1);
  if (!asset) return { ok: false, error: "Property not found" };

  await db
    .update(schema.properties)
    .set({
      currentValuation: String(parsed.data.currentValuation),
      valuationDate: parsed.data.valuationDate,
      updatedAt: new Date(),
    })
    .where(eq(schema.properties.assetId, parsed.data.assetId));

  // Also log a valuation transaction so the historical record is preserved.
  await db.insert(schema.transactions).values({
    userId: profile.id,
    assetId: parsed.data.assetId,
    type: "valuation",
    occurredAt: parsed.data.valuationDate,
    totalAmount: String(parsed.data.currentValuation),
    fees: "0",
    currency: "EUR",
    fxRateToEur: "1",
    notes: "Manual revaluation",
  });

  revalidatePath(`/real-estate/${parsed.data.assetId}`);
  revalidatePath("/real-estate");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ----------------------------- Scenarios ----------------------------- */

export async function createScenarioAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = scenarioInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const d = parsed.data;

  // Verify ownership via the underlying asset.
  const [owner] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, d.propertyId), eq(schema.assets.userId, profile.id)))
    .limit(1);
  if (!owner) return { ok: false, error: "Property not found" };

  const inserted = await db.transaction(async (tx) => {
    if (d.isCurrent) {
      await tx
        .update(schema.rentalScenarios)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(eq(schema.rentalScenarios.propertyId, d.propertyId));
    }
    const [row] = await tx
      .insert(schema.rentalScenarios)
      .values({
        propertyId: d.propertyId,
        name: d.name,
        strategy: d.strategy,
        isCurrent: d.isCurrent,
        monthlyRent: d.monthlyRent != null ? String(d.monthlyRent) : null,
        ltrMonthsPerYear: d.ltrMonthsPerYear ?? null,
        nightlyRate: d.nightlyRate != null ? String(d.nightlyRate) : null,
        occupancyPct: d.occupancyPct != null ? String(d.occupancyPct) : null,
        cleaningFeePerStay: String(d.cleaningFeePerStay),
        avgStayNights: d.avgStayNights != null ? String(d.avgStayNights) : null,
        platformFeePct: String(d.platformFeePct),
        managementFeePct: String(d.managementFeePct),
        monthlyOpex: String(d.monthlyOpex),
        vacancyPct: String(d.vacancyPct),
        notes: d.notes || null,
      })
      .returning({ id: schema.rentalScenarios.id });
    return row!.id;
  });

  revalidatePath(`/real-estate/${d.propertyId}`);
  return { ok: true, data: { id: inserted } };
}

export async function updateScenarioAction(input: unknown): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = updateScenarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const d = parsed.data;

  const [owner] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, d.propertyId), eq(schema.assets.userId, profile.id)))
    .limit(1);
  if (!owner) return { ok: false, error: "Property not found" };

  await db.transaction(async (tx) => {
    if (d.isCurrent) {
      await tx
        .update(schema.rentalScenarios)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(eq(schema.rentalScenarios.propertyId, d.propertyId));
    }
    await tx
      .update(schema.rentalScenarios)
      .set({
        name: d.name,
        strategy: d.strategy,
        isCurrent: d.isCurrent,
        monthlyRent: d.monthlyRent != null ? String(d.monthlyRent) : null,
        ltrMonthsPerYear: d.ltrMonthsPerYear ?? null,
        nightlyRate: d.nightlyRate != null ? String(d.nightlyRate) : null,
        occupancyPct: d.occupancyPct != null ? String(d.occupancyPct) : null,
        cleaningFeePerStay: String(d.cleaningFeePerStay),
        avgStayNights: d.avgStayNights != null ? String(d.avgStayNights) : null,
        platformFeePct: String(d.platformFeePct),
        managementFeePct: String(d.managementFeePct),
        monthlyOpex: String(d.monthlyOpex),
        vacancyPct: String(d.vacancyPct),
        notes: d.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.rentalScenarios.id, d.id));
  });

  revalidatePath(`/real-estate/${d.propertyId}`);
  return { ok: true };
}

export async function setCurrentScenarioAction(
  scenarioId: string,
  propertyId: string,
): Promise<ActionResult> {
  const profile = await requireProfile();
  const [owner] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, propertyId), eq(schema.assets.userId, profile.id)))
    .limit(1);
  if (!owner) return { ok: false, error: "Property not found" };

  await db.transaction(async (tx) => {
    await tx
      .update(schema.rentalScenarios)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(eq(schema.rentalScenarios.propertyId, propertyId));
    await tx
      .update(schema.rentalScenarios)
      .set({ isCurrent: true, updatedAt: new Date() })
      .where(eq(schema.rentalScenarios.id, scenarioId));
  });

  revalidatePath(`/real-estate/${propertyId}`);
  return { ok: true };
}

export async function deleteScenarioAction(
  scenarioId: string,
  propertyId: string,
): Promise<ActionResult> {
  const profile = await requireProfile();
  const [owner] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, propertyId), eq(schema.assets.userId, profile.id)))
    .limit(1);
  if (!owner) return { ok: false, error: "Property not found" };

  await db
    .delete(schema.rentalScenarios)
    .where(eq(schema.rentalScenarios.id, scenarioId));

  revalidatePath(`/real-estate/${propertyId}`);
  return { ok: true };
}
