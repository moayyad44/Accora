import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { DepartmentsService } from "./departments.service";
import { DepartmentsController } from "./departments.controller";
import { PositionsService } from "./positions.service";
import { PositionsController } from "./positions.controller";
import { EmployeesService } from "./employees.service";
import { EmployeesController } from "./employees.controller";
import { ContractsService } from "./contracts.service";
import { ContractsController } from "./contracts.controller";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { LeavesService } from "./leaves.service";
import { LeavesController } from "./leaves.controller";
import { LoansService } from "./loans.service";
import { LoansController } from "./loans.controller";
import { PayrollService } from "./payroll.service";
import { PayrollController } from "./payroll.controller";

@Module({
  imports: [AccountingModule],
  providers: [
    DepartmentsService,
    PositionsService,
    EmployeesService,
    ContractsService,
    AttendanceService,
    LeavesService,
    LoansService,
    PayrollService,
  ],
  controllers: [
    DepartmentsController,
    PositionsController,
    EmployeesController,
    ContractsController,
    AttendanceController,
    LeavesController,
    LoansController,
    PayrollController,
  ],
  exports: [EmployeesService, ContractsService, LoansService, PayrollService],
})
export class HrModule {}
