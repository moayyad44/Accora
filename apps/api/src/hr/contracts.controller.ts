import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ContractsService } from "./contracts.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateContractDto } from "./dto/create-contract.dto";

@Controller("hr/contracts")
export class ContractsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  @Get()
  @RequirePermission("hr", "contract", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("employeeId") employeeId?: string) {
    const companyId = requireActiveCompany(user);
    if (!employeeId) throw new BadRequestException("employeeId query param is required");
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.contractsService.list(tx, companyId, employeeId),
    );
  }

  @Post()
  @RequirePermission("hr", "contract", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateContractDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.contractsService.create(tx, companyId, {
        employeeId: dto.employeeId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        baseSalary: dto.baseSalary,
        terms: dto.terms,
      }),
    );
  }
}
