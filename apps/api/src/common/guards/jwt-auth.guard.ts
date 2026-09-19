import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AccessTokenPayload } from "../types/auth-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
