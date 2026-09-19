import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, type RegisterCompanyInput } from "@/api/auth";
import { tokenStorage, authEvents, AUTH_LOGGED_OUT } from "@/api/token-storage";
import type { CurrentUser } from "@/api/types";

interface AuthContextValue {
  user: CurrentUser | undefined;
  /** True while the very first /users/me check (on page load) is in
   * flight — distinct from a plain "no user yet" so routing can show a
   * loading screen instead of flashing the login page. */
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerCompany: (input: RegisterCompanyInput) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  logout: () => void;
  /** True/false per permission string ("module.resource.action"). A super
   * admin implicitly has everything. */
  hasPermission: (permission: string) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = React.useState(() => !!tokenStorage.getAccessToken());

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: false,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    const onLoggedOut = () => {
      setHasToken(false);
      queryClient.setQueryData(["me"], undefined);
      queryClient.clear();
    };
    authEvents.addEventListener(AUTH_LOGGED_OUT, onLoggedOut);
    return () => authEvents.removeEventListener(AUTH_LOGGED_OUT, onLoggedOut);
  }, [queryClient]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      tokenStorage.setTokens(res.accessToken, res.refreshToken);
      setHasToken(true);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    [queryClient],
  );

  const registerCompany = React.useCallback(
    async (input: RegisterCompanyInput) => {
      const res = await authApi.registerCompany(input);
      tokenStorage.setTokens(res.accessToken, res.refreshToken);
      setHasToken(true);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    [queryClient],
  );

  const switchCompany = React.useCallback(
    async (companyId: string) => {
      const res = await authApi.switchCompany(companyId);
      tokenStorage.setTokens(res.accessToken, res.refreshToken);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      // Every other query is scoped to the previously active company —
      // dropping the whole cache is the only safe move on a company switch.
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    },
    [queryClient],
  );

  const logout = React.useCallback(() => {
    tokenStorage.clear();
    setHasToken(false);
    queryClient.clear();
  }, [queryClient]);

  const hasPermission = React.useCallback(
    (permission: string) => {
      const user = meQuery.data;
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions.includes(permission);
    },
    [meQuery.data],
  );

  const value: AuthContextValue = {
    user: meQuery.data,
    isInitializing: hasToken && meQuery.isPending,
    isAuthenticated: !!meQuery.data,
    login,
    registerCompany,
    switchCompany,
    logout,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
