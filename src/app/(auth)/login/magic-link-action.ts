"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState = { error?: string; sent?: string };

const schema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
});

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return { error: error.message };
  }
  return { sent: parsed.data.email };
}
