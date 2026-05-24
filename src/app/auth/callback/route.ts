import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase redirects here after Google OAuth. We exchange the code for a
 * session. If `handle_new_user` trigger raises EMAIL_NOT_INVITED, the exchange
 * itself succeeds but the user has no profile row — we then sign them out and
 * redirect to /login?error=not_invited.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const msg = exchangeError.message?.toLowerCase() ?? "";
    if (msg.includes("invit") || msg.includes("email_not_invited") || msg.includes("not invited")) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=not_invited", url.origin));
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin),
    );
  }

  // Belt + braces: confirm a profile row was actually created. If not, the
  // invite gate trigger rejected us.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=not_invited", url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
