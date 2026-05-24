import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  hint,
  mono = false,
  accent = false,
  subtle = false,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
  subtle?: boolean;
  tone?: "success" | "danger" | "default";
}) {
  return (
    <Card className={cn(accent && "border-foreground/10 bg-surface-strong/40")}>
      <CardContent className="space-y-1.5 p-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
          {label}
        </div>
        <div
          className={cn(
            "text-2xl",
            mono && "font-mono tabular-nums tracking-tight",
            subtle && "text-text-muted",
            tone === "success" && "text-[var(--success)]",
            tone === "danger" && "text-[var(--danger)]",
          )}
        >
          {value}
        </div>
        {hint ? <div className="text-xs text-text-muted">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
