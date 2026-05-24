"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { refreshPriceAction } from "./refresh-action";

export function RefreshPriceButton({ ticker, category }: { ticker: string; category: string }) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const r = await refreshPriceAction(ticker, category);
        setPending(false);
        if (r.ok) {
          toast.success("Price refreshed.");
          router.refresh();
        } else {
          toast.error(r.error);
        }
      }}
      className="ml-2 inline-flex items-center gap-1 rounded text-xs text-text-muted hover:text-foreground"
      aria-label="Refresh price"
    >
      <RefreshCw className={pending ? "size-3 animate-spin" : "size-3"} />
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
