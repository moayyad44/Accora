import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border",
  {
    variants: {
      variant: {
        neutral: "bg-secondary-subtle text-muted border-border",
        primary: "bg-primary-subtle text-primary border-transparent",
        success: "bg-success-subtle text-success border-success-border",
        warning: "bg-warning-subtle text-warning border-warning-border",
        error: "bg-error-subtle text-error border-error-border",
        info: "bg-info-subtle text-info border-info-border",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
