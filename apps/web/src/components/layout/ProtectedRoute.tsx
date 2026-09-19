import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";

export function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** Wrap a route element with this when the page needs a specific
 * permission beyond just being logged in — hides the page (never just a
 * disabled button) and shows the real "no access" screen, per the
 * project's frontend-security rules: the backend is still the real gate,
 * this only avoids showing a page whose every action would 403 anyway. */
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }
  return <>{children}</>;
}
