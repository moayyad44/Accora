import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AccessTokenPayload } from "../types/auth-user";

/** Reads the authenticated user (set by JwtAuthGuard) in a controller. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
