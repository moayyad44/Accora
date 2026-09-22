import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Get("me")
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.prisma.withTenant({ companyId: user.companyId, userId: user.sub, isSuperAdmin: user.isSuperAdmin }, (tx) =>
      this.usersService.me(tx, user.sub, user.companyId, user.roleId),
    );
  }

  @Get()
  @RequirePermission("core", "user", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.usersService.listCompanyUsers(tx, companyId),
    );
  }

  @Post()
  @RequirePermission("core", "user", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateUserDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.usersService.createCompanyUser(tx, companyId, dto),
    );
  }

  @Patch(":id")
  @RequirePermission("core", "user", "update")
  update(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    const companyId = requireActiveCompany(user);
    if (id === user.sub && dto.isActive === false) {
      throw new BadRequestException("You cannot deactivate your own account");
    }
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.usersService.updateCompanyUser(tx, companyId, id, dto),
    );
  }
}
