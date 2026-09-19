import { api } from "./client";

export type ApprovalRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ApprovalDecision = "APPROVED" | "REJECTED";

export interface ApprovalStep {
  id: string;
  stepOrder: number;
  name: string;
  approverRoleId: string | null;
  approverRole: { id: string; name: string; nameAr: string | null } | null;
}

export interface ApprovalWorkflow {
  id: string;
  docType: string;
  name: string;
  conditions: { minAmount?: string } | null;
  isActive: boolean;
  steps: ApprovalStep[];
}

export interface CreateApprovalWorkflowInput {
  docType: string;
  name: string;
  conditions?: { minAmount?: string };
  steps: { name: string; approverRoleId?: string }[];
}

export interface ApprovalAction {
  id: string;
  requestId: string;
  stepOrder: number;
  userId: string;
  decision: ApprovalDecision;
  comment: string | null;
  actedAt: string;
}

export interface ApprovalWorkflowSummary {
  id: string;
  docType: string;
  name: string;
  conditions: { minAmount?: string } | null;
  isActive: boolean;
}

export interface ApprovalRequestListItem {
  id: string;
  workflowId: string;
  workflow: ApprovalWorkflowSummary;
  docType: string;
  docId: string;
  currentStep: number;
  status: ApprovalRequestStatus;
  createdAt: string;
}

export interface ApprovalRequestDetail extends ApprovalRequestListItem {
  workflow: ApprovalWorkflow;
  actions: ApprovalAction[];
}

export interface CreateApprovalRequestInput {
  docType: string;
  docId: string;
  amount: string;
}

export const approvalsApi = {
  workflows: {
    list: (docType?: string) => api.get<ApprovalWorkflow[]>(`/approvals/workflows${docType ? `?docType=${docType}` : ""}`),
    get: (id: string) => api.get<ApprovalWorkflow>(`/approvals/workflows/${id}`),
    create: (input: CreateApprovalWorkflowInput) => api.post<ApprovalWorkflow>("/approvals/workflows", input),
  },
  requests: {
    list: (status?: ApprovalRequestStatus) =>
      api.get<ApprovalRequestListItem[]>(`/approvals/requests${status ? `?status=${status}` : ""}`),
    get: (id: string) => api.get<ApprovalRequestDetail>(`/approvals/requests/${id}`),
    create: (input: CreateApprovalRequestInput) => api.post<ApprovalRequestDetail>("/approvals/requests", input),
    decide: (id: string, decision: ApprovalDecision, comment?: string) =>
      api.post<ApprovalRequestDetail>(`/approvals/requests/${id}/decide`, { decision, comment }),
  },
};
