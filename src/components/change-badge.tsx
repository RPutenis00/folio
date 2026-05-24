import { cn, formatCurrency, formatPercent } from "@/lib/utils";

export function ChangeBadge({
  value,
  base,
  compact = false,
}: {
  value: number;
  base?: number;
  compact?: boolean;
}) {
  if (!Number.isFinite(value)) {
    return <span className="text-text-muted">—</span>;
  }
  const positive = value >= 0;
  const pct = base && base !== 0 ? value / base : null;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 tabular-nums",
        positive ? "text-[var(--success)]" : "text-[var(--danger)]",
      )}
    >
      <span>{formatCurrency(value, { signed: true, compact })}</span>
      {pct != null ? <span className="text-xs opacity-70">({formatPercent(pct)})</span> : null}
    </span>
  );
}
