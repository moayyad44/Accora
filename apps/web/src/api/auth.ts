import { api } from "./client";
import type { AuthResponse, LoginResponse, MyCompany, CurrentUser } from "./types";

export interface RegisterCompanyInput {
  companyName: string;
  companyNameAr?: string;
  country?: string;
  baseCurrencyCode: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

export const authApi = {
  registerCompany: (input: RegisterCompanyInput) =>
    api.post<AuthResponse>("/auth/register-company", input, { skipAuth: true }),

  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }, { skipAuth: true }),

  switchCompany: (companyId: string) => api.post<AuthResponse>("/auth/switch-company", { companyId }),

  me: () => api.get<CurrentUser>("/users/me"),

  myCompanies: () => api.get<MyCompany[]>("/companies"),
};
