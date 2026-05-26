"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

export type SignInState = { error?: string };

const schemaInput = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  next: z.string().optional(),
});

export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = schemaInput.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const email = parsed.data.email;

  // Invite gate
  const [invited] = await db
    .select()
    .from(schema.invitedEmails)
    .where(eq(schema.invitedEmails.email, email))
    .limit(1);
  if (!invited) {
    return { error: "This email isn't on the invite list." };
  }

  // Upsert profile
  const [existing] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.email, email))
    .limit(1);

  const isSeededAdmin =
    process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() === email;

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Keep admin flag in sync if env still says so
    if (isSeededAdmin && !existing.isAdmin) {
      await db
        .update(schema.profiles)
        .set({ isAdmin: true })
        .where(eq(schema.profiles.id, userId));
    }
  } else {
    userId = randomUUID();
    await db.insert(schema.profiles).values({
      id: userId,
      email,
      displayName: email.split("@")[0],
      isAdmin: isSeededAdmin,
    });
  }

  const session = await getSession();
  session.userId = userId;
  session.email = email;
  await session.save();

  redirect(parsed.data.next || "/dashboard");
}
