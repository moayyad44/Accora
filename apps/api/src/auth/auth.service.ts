import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CompaniesService } from "../companies/companies.service";
import { RegisterCompanyDto } from "./dto/register-company.dto";
import { LoginDto } from "./dto/login.dto";
import { AccessTokenPayload, RefreshTokenPayload } from "../common/types/auth-user";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly jwtService: JwtService,
  ) {}

  /** Self-service signup: creates the user AND their first company in one
   * transaction, with that company's own chart of accounts and roles
   * already cloned from the global templates, and the new user set up as
   * that company's Company Admin. See docs/ARCHITECTURE.md §6. */
  async registerCompany(dto: RegisterCompanyDto) {
    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_ROUNDS);

    const result = await this.prisma.withTenant({ companyId: null, userId: null }, async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: dto.adminEmail } });
      if (existing) throw new BadRequestException("This email is already registered");

      const user = await tx.user.create({
        data: { email: dto.adminEmail, passwordHash, fullName: dto.adminFullName },
      });

      const { companyId, companyAdminRoleId } = await this.companiesService.createCompany(
        tx,
        {
          name: dto.companyName,
          nameAr: dto.companyNameAr,
          country: dto.country,
          baseCurrencyCode: dto.baseCurrencyCode,
        },
        user.id,
      );

      await tx.userCompanyAccess.create({
        data: { userId: user.id, companyId, roleId: companyAdminRoleId },
      });

      return { user, companyId, roleId: companyAdminRoleId };
    });

    return this.buildAuthResponse(result.user.id, result.user.email, false, result.companyId, result.roleId);
  }

  async login(dto: LoginDto) {
    const outcome = await this.prisma.withTenant({ companyId: null, userId: null }, async (tx) => {
      const user = await tx.user.findUnique({ where: { email: dto.email } });
      if (!user || !user.isActive) throw new UnauthorizedException("Invalid email or password");

      const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
      if (!passwordOk) throw new UnauthorizedException("Invalid email or password");

      await this.prisma.setSessionContext(tx, { companyId: null, userId: user.id, isSuperAdmin: user.isSuperAdmin });
      const companies = await this.companiesService.listMyCompanies(tx, user.id);

      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      return { user, companies };
    });

    const defaultCompany = outcome.companies[0];
    const response = this.buildAuthResponse(
      outcome.user.id,
      outcome.user.email,
      outcome.user.isSuperAdmin,
      defaultCompany?.companyId ?? null,
      defaultCompany?.roleId ?? null,
    );
    return { ...response, companies: outcome.companies };
  }

  async switchCompany(userId: string, email: string, isSuperAdmin: boolean, companyId: string) {
    const access = await this.prisma.withTenant({ companyId: null, userId }, (tx) =>
      tx.userCompanyAccess.findFirst({
        where: { userId, companyId, isActive: true },
        include: { role: true },
      }),
    );
    if (!access) throw new ForbiddenException("You do not have access to that company");

    return this.buildAuthResponse(userId, email, isSuperAdmin, access.companyId, access.roleId);
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (payload.tokenType !== "refresh") throw new UnauthorizedException("Not a refresh token");

    const user = await this.prisma.withTenant({ companyId: null, userId: payload.sub }, (tx) =>
      tx.user.findUnique({ where: { id: payload.sub } }),
    );
    if (!user || !user.isActive) throw new UnauthorizedException("User no longer active");

    // The refresh token carries no company context by design (it's
    // long-lived and company access can change); the client re-selects the
    // active company via /auth/switch-company right after refreshing.
    return this.buildAuthResponse(user.id, user.email, user.isSuperAdmin, null, null);
  }

  private buildAuthResponse(
    userId: string,
    email: string,
    isSuperAdmin: boolean,
    companyId: string | null,
    roleId: string | null,
  ) {
    const accessPayload: AccessTokenPayload = { sub: userId, email, companyId, roleId, isSuperAdmin };
    const refreshPayload: RefreshTokenPayload = { sub: userId, tokenType: "refresh" };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? "15m",
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_TTL ?? "7d",
    });

    return { accessToken, refreshToken, companyId, roleId };
  }
}
