import { Module } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { AuditLogController } from "./audit-log.controller";

/** A leaf module with no dependencies on any other feature module, so
 * anything (AccountingModule, AuthModule, ...) can import it freely
 * without risking a circular dependency. */
@Module({
  providers: [AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditModule {}
