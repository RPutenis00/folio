"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/current-user";

const emailSchema = z
  .object({
    email: z.string().email().transform((v) => v.trim().toLowerCase()),
    note: z.string().max(500).optional().or(z.literal("")),
  });

export type InviteFormState = { error?: string; ok?: boolean };

export async function inviteEmail(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const admin = await requireAdmin();
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  try {
    await db
      .insert(schema.invitedEmails)
      .values({ email: parsed.data.email, invitedBy: admin.id, note: parsed.data.note || null })
      .onConflictDoNothing();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }

  revalidatePath("/settings/invites");
  return { ok: true };
}

export async function revokeInvite(email: string) {
  await requireAdmin();
  await db.delete(schema.invitedEmails).where(eq(schema.invitedEmails.email, email.toLowerCase()));
  revalidatePath("/settings/invites");
}
