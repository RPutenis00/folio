import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import type { Profile } from "@/lib/db/schema";

/**
 * Returns the signed-in profile or null. Memoized for the request.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);

  return profile ?? null;
});

/**
 * Returns the signed-in profile or throws — use in pages that require auth.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("Not authenticated");
  }
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.isAdmin) {
    throw new Error("Admin only");
  }
  return profile;
}
