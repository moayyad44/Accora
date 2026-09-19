import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DepartmentsService } from "./departments.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateDepartmentDto } from "./dto/create-department.dto";

@Controller("hr/departments")
export class DepartmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  @Get()
  @RequirePermission("hr", "department", "view")
  list(@CurrentUser() user: AccessTokenPayload) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.departmentsService.list(tx, companyId));
  }

  @Get(":id")
  @RequirePermission("hr", "department", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.departmentsService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("hr", "department", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateDepartmentDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.departmentsService.create(tx, companyId, dto),
    );
  }
}
