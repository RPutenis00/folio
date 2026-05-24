"use client";

import * as React from "react";
import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "./magic-link-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: MagicLinkState = {};

export function MagicLinkForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initial);

  if (state.sent) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
        <p className="font-medium text-foreground">Check your inbox</p>
        <p className="text-text-muted">
          We sent a sign-in link to <span className="font-medium">{state.sent}</span>. Local dev
          inbox: <a href="http://localhost:54324" className="underline" target="_blank" rel="noopener noreferrer">http://localhost:54324</a>.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@example.com" />
      </div>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
