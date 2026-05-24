import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        accent: "border-transparent bg-accent text-accent-foreground",
        success:
          "border-transparent bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]",
        warning:
          "border-transparent bg-[color-mix(in_oklab,var(--warning)_18%,transparent)] text-[var(--warning)]",
        destructive:
          "border-transparent bg-[color-mix(in_oklab,var(--danger)_18%,transparent)] text-[var(--danger)]",
        muted: "border-transparent bg-surface-muted text-text-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
