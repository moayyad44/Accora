import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", {
  variants: {
    variant: {
      info: "bg-info-subtle border-info-border text-info",
      success: "bg-success-subtle border-success-border text-success",
      warning: "bg-warning-subtle border-warning-border text-warning",
      error: "bg-error-subtle border-error-border text-error",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? "info"];
  return (
    <div className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="text-foreground">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
    </div>
  );
}
