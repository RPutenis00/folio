"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { inviteEmail, type InviteFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: InviteFormState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteEmail, initial);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Invite added.");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto]">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="name@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" placeholder="Optional — e.g. partner, accountant" />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add invite"}
        </Button>
      </div>
    </form>
  );
}
