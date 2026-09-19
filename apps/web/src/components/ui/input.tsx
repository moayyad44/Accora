import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground",
        "placeholder:text-subtle transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-error focus-visible:ring-error",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
