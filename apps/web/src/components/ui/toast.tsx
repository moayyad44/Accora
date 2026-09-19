import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: <CheckCircle2 className="size-5 text-success" />,
  error: <XCircle className="size-5 text-error" />,
  warning: <AlertTriangle className="size-5 text-warning" />,
  info: <Info className="size-5 text-info" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback<ToastContextValue["toast"]>(({ title, description, variant = "default" }) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, title, description, variant }]);
  }, []);

  const remove = (id: string) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => !open && remove(item.id)}
            className={cn(
              "flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-4 shadow-lg",
              "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
            )}
          >
            {VARIANT_ICON[item.variant]}
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold text-foreground">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-muted">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="text-subtle hover:text-foreground">
              <X className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 end-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
