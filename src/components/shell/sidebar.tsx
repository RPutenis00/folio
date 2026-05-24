"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CandlestickChart,
  Home,
  Settings,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: CandlestickChart },
  { href: "/real-estate", label: "Real Estate", icon: Home },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const items = [
    ...NAV,
    ...(isAdmin ? [{ href: "/settings/invites", label: "Invites", icon: UserPlus }] : []),
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
      <Link href="/dashboard" className="mb-8 px-2">
        <span className="font-display text-2xl tracking-tight">Folio</span>
      </Link>

      <nav className="flex-1 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-muted text-foreground"
                  : "text-text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active && "text-accent")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 text-[10px] uppercase tracking-[0.18em] text-text-subtle">
        v0.1 · EUR base
      </div>
    </aside>
  );
}
