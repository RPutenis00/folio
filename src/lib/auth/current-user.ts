import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getSession } from "./session";
import type { Profile } from "@/lib/db/schema";

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const session = await getSession();
  if (!session.userId) return null;

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, session.userId))
    .limit(1);

  return profile ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.isAdmin) throw new Error("Admin only");
  return profile;
}
