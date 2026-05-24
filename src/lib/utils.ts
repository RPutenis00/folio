import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-IE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_FORMATTER = new Intl.NumberFormat("en-IE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-IE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const QUANTITY_FORMATTER = new Intl.NumberFormat("en-IE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});

/**
 * Format a number as currency. Defaults to EUR.
 * Pass `currency` to render in a different ISO code.
 */
export function formatCurrency(
  value: number | null | undefined,
  options: { currency?: string; compact?: boolean; signed?: boolean } = {},
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const { currency = "EUR", compact = false, signed = false } = options;
  const formatter = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? "compact" : "standard",
    signDisplay: signed ? "exceptZero" : "auto",
  });
  return formatter.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return NUMBER_FORMATTER.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return COMPACT_FORMATTER.format(value);
}

/** Input is a ratio: 0.075 → "7.5%" */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return PERCENT_FORMATTER.format(value);
}

export function formatQuantity(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return QUANTITY_FORMATTER.format(value);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}
