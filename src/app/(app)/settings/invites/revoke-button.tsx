"use client";

import * as React from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { revokeInvite } from "./actions";
import { Button } from "@/components/ui/button";

export function RevokeButton({ email }: { email: string }) {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`Revoke ${email}`}
      onClick={async () => {
        if (!confirm(`Revoke invite for ${email}?`)) return;
        setPending(true);
        try {
          await revokeInvite(email);
          toast.success("Invite revoked.");
        } catch {
          toast.error("Failed to revoke.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Trash2 className="size-4 text-text-muted" />
    </Button>
  );
}
