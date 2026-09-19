import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalDecision, ApprovalRequestStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

/**
 * The generic approval gate: any module can ask "does this document need
 * approval, and has it gotten it?" without this module knowing anything
 * about sales invoices, purchase invoices, or whatever else — docType is
 * just a caller-chosen string, and conditions.minAmount is compared
 * against whatever amount the caller passes in.
 *
 * Deliberately two separate operations rather than one auto-creating
 * check: requestApproval() writes (creates the PENDING request);
 * checkApproved() only reads and throws. A poster (e.g.
 * PurchaseInvoicesService.post()) calls checkApproved() — if it silently
 * auto-created a request and then threw, the whole enclosing DB
 * transaction (including that insert) would roll back with it, since
 * post() and this check share one Prisma transaction. Requesting approval
 * is therefore always its own, separate call — the same
 * draft-then-separate-action shape already used by production orders,
 * payroll runs, etc. in this system.
 */
@Injectable()
export class ApprovalService {
  async findApplicableWorkflow(tx: Prisma.TransactionClient, companyId: string, docType: string, amount: Decimal) {
    const workflows = await tx.approvalWorkflow.findMany({
      where: { companyId, docType, isActive: true },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    for (const workflow of workflows) {
      const conditions = workflow.conditions as { minAmount?: string } | null;
      const minAmount = conditions?.minAmount ? new Decimal(conditions.minAmount) : null;
      if (!minAmount || amount.gte(minAmount)) return workflow;
    }
    return null;
  }

  async requestApproval(tx: Prisma.TransactionClient, companyId: string, docType: string, docId: string, amount: string) {
    const workflow = await this.findApplicableWorkflow(tx, companyId, docType, new Decimal(amount));
    if (!workflow) {
      throw new BadRequestException(`No active approval workflow applies to this ${docType} at this amount`);
    }

    const existing = await tx.approvalRequest.findFirst({ where: { docType, docId }, orderBy: { createdAt: "desc" } });
    if (existing?.status === ApprovalRequestStatus.PENDING) {
      throw new BadRequestException("An approval request is already pending for this document");
    }
    if (existing?.status === ApprovalRequestStatus.APPROVED) {
      throw new BadRequestException("This document is already approved");
    }

    return tx.approvalRequest.create({
      data: { workflowId: workflow.id, docType, docId, currentStep: 1, status: ApprovalRequestStatus.PENDING },
      include: { workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } } },
    });
  }

  /** Read-only gate for a poster to call before committing its own
   * transaction: silently returns when no workflow applies or the latest
   * request is APPROVED, otherwise throws a clear, actionable message. */
  async checkApproved(tx: Prisma.TransactionClient, companyId: string, docType: string, docId: string, amount: Decimal) {
    const workflow = await this.findApplicableWorkflow(tx, companyId, docType, amount);
    if (!workflow) return;

    const request = await tx.approvalRequest.findFirst({
      where: { docType, docId },
      orderBy: { createdAt: "desc" },
      include: { workflow: { include: { steps: true } } },
    });
    if (!request) {
      throw new BadRequestException(
        `This document requires approval (workflow "${workflow.name}") before it can be posted — request approval first via POST /approvals/requests.`,
      );
    }
    if (request.status === ApprovalRequestStatus.PENDING) {
      throw new BadRequestException(
        `Approval request ${request.id} is still pending (step ${request.currentStep} of ${request.workflow.steps.length}).`,
      );
    }
    if (request.status === ApprovalRequestStatus.REJECTED) {
      throw new BadRequestException(
        `Approval request ${request.id} was rejected — this document cannot be posted until a new approval is requested and granted.`,
      );
    }
    // APPROVED -> proceed silently.
  }

  async get(tx: Prisma.TransactionClient, companyId: string, requestId: string) {
    const request = await tx.approvalRequest.findFirst({
      where: { id: requestId, workflow: { companyId } },
      include: { workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } }, actions: { orderBy: { actedAt: "asc" } } },
    });
    if (!request) throw new NotFoundException("Approval request not found");
    return request;
  }

  async list(tx: Prisma.TransactionClient, companyId: string, status?: ApprovalRequestStatus) {
    return tx.approvalRequest.findMany({
      where: { workflow: { companyId }, ...(status ? { status } : {}) },
      include: { workflow: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async decide(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    requestId: string,
    decision: ApprovalDecision,
    comment?: string,
  ) {
    const request = await tx.approvalRequest.findFirst({
      where: { id: requestId, workflow: { companyId } },
      include: { workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } } },
    });
    if (!request) throw new NotFoundException("Approval request not found");
    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
    }

    const step = request.workflow.steps.find((s) => s.stepOrder === request.currentStep);
    if (!step) throw new BadRequestException("Workflow has no such step — it may have been edited after this request started");

    if (step.approverRoleId) {
      const access = await tx.userCompanyAccess.findFirst({ where: { userId, companyId, isActive: true } });
      if (!access || access.roleId !== step.approverRoleId) {
        throw new ForbiddenException(`You are not the designated approver for step "${step.name}"`);
      }
    }

    await tx.approvalAction.create({
      data: { requestId: request.id, stepOrder: request.currentStep, userId, decision, comment },
    });

    if (decision === ApprovalDecision.REJECTED) {
      return tx.approvalRequest.update({
        where: { id: request.id },
        data: { status: ApprovalRequestStatus.REJECTED },
        include: { actions: { orderBy: { actedAt: "asc" } } },
      });
    }

    const isLastStep = request.currentStep >= request.workflow.steps.length;
    return tx.approvalRequest.update({
      where: { id: request.id },
      data: isLastStep
        ? { status: ApprovalRequestStatus.APPROVED }
        : { currentStep: request.currentStep + 1 },
      include: { actions: { orderBy: { actedAt: "asc" } } },
    });
  }
}
