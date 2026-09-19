import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./alert-dialog";
import { useTranslation } from "react-i18next";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open && state) {
      state.resolve(false);
      setState(null);
    }
  };

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!state} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          {state && (
            <>
              <AlertDialogTitle>{state.options.title}</AlertDialogTitle>
              {state.options.description && (
                <AlertDialogDescription>{state.options.description}</AlertDialogDescription>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => handleOpenChange(false)}>
                  {state.options.cancelLabel ?? t("common.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction destructive={state.options.destructive} onClick={handleConfirm}>
                  {state.options.confirmLabel ?? t("common.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
