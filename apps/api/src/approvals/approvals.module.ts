import { Module } from "@nestjs/common";
import { ApprovalWorkflowsService } from "./approval-workflows.service";
import { ApprovalWorkflowsController } from "./approval-workflows.controller";
import { ApprovalService } from "./approval.service";
import { ApprovalRequestsController } from "./approval-requests.controller";

@Module({
  providers: [ApprovalWorkflowsService, ApprovalService],
  controllers: [ApprovalWorkflowsController, ApprovalRequestsController],
  exports: [ApprovalService],
})
export class ApprovalsModule {}
