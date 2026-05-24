"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type Slice = { label: string; value: number };

export function AllocationDonut({ data, totalEur }: { data: Slice[]; totalEur: number }) {
  const items = data.filter((d) => d.value > 0);
  if (items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-muted">
        No allocation yet.
      </div>
    );
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr_1fr]">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="label"
            innerRadius={60}
            outerRadius={92}
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {items.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 12,
            }}
            formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-2 text-sm">
        {items.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="capitalize">{d.label.replace("_", " ")}</span>
            </span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span>{formatCurrency(d.value, { compact: true })}</span>
              <span className="text-xs text-text-muted">
                {totalEur > 0 ? formatPercent(d.value / totalEur) : "0.0%"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
