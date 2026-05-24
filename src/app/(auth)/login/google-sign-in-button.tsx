"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({ next }: { next?: string }) {
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    setPending(true);
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      size="lg"
      variant="outline"
      className="w-full justify-center gap-3"
    >
      <GoogleIcon />
      {pending ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.46-1.12 2.69-2.39 3.52v2.93h3.86c2.27-2.09 3.58-5.17 3.58-8.69z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-2.93c-1.07.72-2.44 1.16-4.07 1.16-3.13 0-5.79-2.11-6.74-4.96H1.27v3.09C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC04"
        d="M5.26 14.36c-.24-.72-.38-1.49-.38-2.36s.14-1.64.38-2.36V6.55H1.27C.46 8.14 0 9.99 0 12s.46 3.86 1.27 5.45l3.99-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.55l3.99 3.09C6.21 6.85 8.87 4.74 12 4.74z"
      />
    </svg>
  );
}
