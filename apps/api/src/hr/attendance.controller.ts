import { Body, Controller, Get, Post, Query, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceService } from "./attendance.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { RecordAttendanceDto } from "./dto/record-attendance.dto";

@Controller("hr/attendance")
export class AttendanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Get()
  @RequirePermission("hr", "attendance", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("employeeId") employeeId?: string) {
    const companyId = requireActiveCompany(user);
    if (!employeeId) throw new BadRequestException("employeeId query param is required");
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.attendanceService.list(tx, companyId, employeeId),
    );
  }

  @Post()
  @RequirePermission("hr", "attendance", "create")
  record(@CurrentUser() user: AccessTokenPayload, @Body() dto: RecordAttendanceDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.attendanceService.record(tx, companyId, {
        employeeId: dto.employeeId,
        date: new Date(dto.date),
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
        overtimeHours: dto.overtimeHours,
        status: dto.status,
      }),
    );
  }
}
