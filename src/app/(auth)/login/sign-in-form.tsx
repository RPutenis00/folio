"use client";
import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";
import { Input } from "@/components/ui/input";

const initial: SignInState = {};

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initial);
  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <Input name="email" type="email" required />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <p style={{ color: "red" }}>{state.error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "..." : "Sign in"}</button>
    </form>
  );
}
