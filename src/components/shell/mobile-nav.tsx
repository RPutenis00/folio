"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CandlestickChart, Home, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dash", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: CandlestickChart },
  { href: "/real-estate", label: "Real", icon: Home },
  { href: "/settings", label: "More", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-surface/95 backdrop-blur lg:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[10px]",
              active ? "text-foreground" : "text-text-muted",
            )}
          >
            <Icon className={cn("size-5", active && "text-accent")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
