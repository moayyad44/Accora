import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateApprovalWorkflowStepInput {
  name: string;
  approverRoleId?: string;
}

export interface CreateApprovalWorkflowInput {
  /** A caller-defined identifier for the kind of document this gates —
   * e.g. "PURCHASE_INVOICE". Not an enum: any module can define its own
   * approval gate without this module knowing about it in advance. */
  docType: string;
  name: string;
  /** e.g. { minAmount: "5000" } — a document below the threshold isn't
   * gated at all. Omit for "always applies". */
  conditions?: Record<string, unknown>;
  steps: CreateApprovalWorkflowStepInput[];
}

@Injectable()
export class ApprovalWorkflowsService {
  async list(tx: Prisma.TransactionClient, companyId: string, docType?: string) {
    return tx.approvalWorkflow.findMany({
      where: { companyId, ...(docType ? { docType } : {}) },
      include: { steps: { orderBy: { stepOrder: "asc" }, include: { approverRole: true } } },
      orderBy: { name: "asc" },
    });
  }

  async get(tx: Prisma.TransactionClient, companyId: string, id: string) {
    const workflow = await tx.approvalWorkflow.findFirst({
      where: { id, companyId },
      include: { steps: { orderBy: { stepOrder: "asc" }, include: { approverRole: true } } },
    });
    if (!workflow) throw new NotFoundException("Approval workflow not found");
    return workflow;
  }

  async create(tx: Prisma.TransactionClient, companyId: string, input: CreateApprovalWorkflowInput) {
    if (input.steps.length === 0) throw new BadRequestException("A workflow needs at least one step");

    for (const step of input.steps) {
      if (step.approverRoleId) {
        const role = await tx.role.findFirst({ where: { id: step.approverRoleId, companyId } });
        if (!role) throw new NotFoundException(`Role ${step.approverRoleId} not found in this company`);
      }
    }

    return tx.approvalWorkflow.create({
      data: {
        companyId,
        docType: input.docType,
        name: input.name,
        conditions: (input.conditions as Prisma.InputJsonValue) ?? undefined,
        steps: {
          create: input.steps.map((s, index) => ({
            stepOrder: index + 1,
            name: s.name,
            approverRoleId: s.approverRoleId,
          })),
        },
      },
      include: { steps: { include: { approverRole: true } } },
    });
  }
}
