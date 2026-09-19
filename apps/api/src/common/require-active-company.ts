import { ForbiddenException } from "@nestjs/common";
import { AccessTokenPayload } from "./types/auth-user";

/** Every tenant-scoped controller needs an active company before it can do
 * anything — this is the one place that check lives so the error message
 * stays consistent. */
export function requireActiveCompany(user: AccessTokenPayload): string {
  if (!user.companyId) {
    throw new ForbiddenException("No active company selected — call /auth/switch-company first");
  }
  return user.companyId;
}
