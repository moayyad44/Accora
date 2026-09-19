import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { EmployeeStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeesService } from "./employees.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateEmployeeDto } from "./dto/create-employee.dto";

@Controller("hr/employees")
export class EmployeesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Get()
  @RequirePermission("hr", "employee", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("status") status?: EmployeeStatus) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.employeesService.list(tx, companyId, status),
    );
  }

  @Get(":id")
  @RequirePermission("hr", "employee", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) => this.employeesService.get(tx, companyId, id));
  }

  @Post()
  @RequirePermission("hr", "employee", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateEmployeeDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.employeesService.create(tx, companyId, {
        fullName: dto.fullName,
        fullNameAr: dto.fullNameAr,
        nationalId: dto.nationalId,
        phone: dto.phone,
        email: dto.email,
        hireDate: new Date(dto.hireDate),
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
      }),
    );
  }
}
