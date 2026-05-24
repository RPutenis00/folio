"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/current-user";
import { createAssetSchema, updateAssetSchema } from "@/lib/validators/asset";
import {
  transactionInputSchema,
  updateTransactionSchema,
} from "@/lib/validators/transaction";
import { fetchEurFxRate } from "@/lib/pricing/frankfurter";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */
export async function createAssetAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = createAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  try {
    const [row] = await db
      .insert(schema.assets)
      .values({
        userId: profile.id,
        category: parsed.data.category,
        name: parsed.data.name,
        ticker: parsed.data.ticker || null,
        currency: parsed.data.currency,
        metadata: parsed.data.notes ? { notes: parsed.data.notes } : {},
      })
      .returning({ id: schema.assets.id });
    revalidatePath("/assets");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: row!.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create asset" };
  }
}

export async function updateAssetAction(input: unknown): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = updateAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  await db
    .update(schema.assets)
    .set({
      name: parsed.data.name,
      ticker: parsed.data.ticker || null,
      currency: parsed.data.currency,
      status: parsed.data.status,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.assets.id, parsed.data.id), eq(schema.assets.userId, profile.id)));

  revalidatePath("/assets");
  revalidatePath(`/assets/${parsed.data.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAssetAction(id: string): Promise<ActionResult> {
  const profile = await requireProfile();
  await db
    .delete(schema.assets)
    .where(and(eq(schema.assets.id, id), eq(schema.assets.userId, profile.id)));
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  redirect("/assets");
}

/* ------------------------------------------------------------------ *
 * Transactions
 * ------------------------------------------------------------------ */
export async function createTransactionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireProfile();
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  // Snapshot FX-to-EUR at the transaction date.
  let fx = 1;
  try {
    fx = await fetchEurFxRate(parsed.data.currency, new Date(parsed.data.occurredAt));
  } catch {
    fx = 1; // Fallback: assume 1:1 — user can edit if needed.
  }

  // Verify the asset belongs to this user.
  const [asset] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, parsed.data.assetId), eq(schema.assets.userId, profile.id)))
    .limit(1);
  if (!asset) return { ok: false, error: "Asset not found" };

  const [row] = await db
    .insert(schema.transactions)
    .values({
      userId: profile.id,
      assetId: parsed.data.assetId,
      type: parsed.data.type,
      occurredAt: parsed.data.occurredAt,
      quantity: parsed.data.quantity != null ? String(parsed.data.quantity) : null,
      unitPrice: parsed.data.unitPrice != null ? String(parsed.data.unitPrice) : null,
      totalAmount: String(parsed.data.totalAmount),
      fees: String(parsed.data.fees),
      currency: parsed.data.currency,
      fxRateToEur: String(fx),
      category: parsed.data.category || null,
      notes: parsed.data.notes || null,
    })
    .returning({ id: schema.transactions.id });

  revalidatePath(`/assets/${parsed.data.assetId}`);
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  revalidatePath(`/real-estate/${parsed.data.assetId}`);
  revalidatePath("/real-estate");
  return { ok: true, data: { id: row!.id } };
}

export async function updateTransactionAction(input: unknown): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  let fx = 1;
  try {
    fx = await fetchEurFxRate(parsed.data.currency, new Date(parsed.data.occurredAt));
  } catch {
    fx = 1;
  }

  await db
    .update(schema.transactions)
    .set({
      type: parsed.data.type,
      occurredAt: parsed.data.occurredAt,
      quantity: parsed.data.quantity != null ? String(parsed.data.quantity) : null,
      unitPrice: parsed.data.unitPrice != null ? String(parsed.data.unitPrice) : null,
      totalAmount: String(parsed.data.totalAmount),
      fees: String(parsed.data.fees),
      currency: parsed.data.currency,
      fxRateToEur: String(fx),
      category: parsed.data.category || null,
      notes: parsed.data.notes || null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.transactions.id, parsed.data.id), eq(schema.transactions.userId, profile.id)),
    );

  revalidatePath(`/assets/${parsed.data.assetId}`);
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  revalidatePath(`/real-estate/${parsed.data.assetId}`);
  revalidatePath("/real-estate");
  return { ok: true };
}

export async function deleteTransactionAction(
  id: string,
  assetId: string,
): Promise<ActionResult> {
  const profile = await requireProfile();
  await db
    .delete(schema.transactions)
    .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, profile.id)));

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  revalidatePath(`/real-estate/${assetId}`);
  revalidatePath("/real-estate");
  return { ok: true };
}
