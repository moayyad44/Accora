/** Shapes mirrored from the backend's actual response bodies (see
 * src/auth/auth.service.ts, src/users/users.service.ts,
 * src/companies/companies.service.ts) — kept intentionally minimal and
 * hand-written rather than generated, since the backend has no OpenAPI
 * schema yet. */

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  companyId: string | null;
  roleId: string | null;
}

export interface LoginResponse extends AuthResponse {
  companies: MyCompany[];
}

export interface MyCompany {
  companyId: string;
  companyName: string;
  roleId: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  fullNameAr: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  companyId: string | null;
  role: { id: string; name: string; nameAr: string | null } | null;
  permissions: string[];
}
