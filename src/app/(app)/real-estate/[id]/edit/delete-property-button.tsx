"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { deletePropertyAction } from "../../actions";

export function DeletePropertyButton({ assetId }: { assetId: string }) {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="outline"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Delete this property and everything attached to it?")) return;
        setPending(true);
        try {
          await deletePropertyAction(assetId);
        } catch {
          setPending(false);
        }
      }}
    >
      Delete property
    </Button>
  );
}
