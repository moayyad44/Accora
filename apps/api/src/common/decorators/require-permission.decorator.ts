import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSION_KEY = "requiredPermission";

export interface RequiredPermission {
  module: string;
  resource: string;
  action: string;
}

/** Declares which (module, resource, action) permission PermissionsGuard
 * must find on the caller's role before the route handler runs. */
export const RequirePermission = (module: string, resource: string, action: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, { module, resource, action } as RequiredPermission);
