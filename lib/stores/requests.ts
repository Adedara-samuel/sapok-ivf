import { z } from "zod";
import { requestSchema, RequestKind, type StaffRequest } from "@/lib/schemas/admin";
import { isoDate, money } from "@/lib/schemas/common";
import { getSeed, seedSlice } from "@/lib/seed/build";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { useNotificationStore } from "@/lib/stores/notifications";
import { currentActorId } from "@/lib/stores/session";
import { useStaffStore } from "@/lib/stores/staff";
import { nowIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export const createRequestSchema = z
  .object({
    kind: RequestKind,
    title: z.string().min(3, "Give the request a short title"),
    details: z.string().min(3, "Add a few details"),
    amount: money.optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    entityId: z.string().optional(),
    attachmentName: z.string().optional(),
  })
  .refine((r) => r.kind !== "leave" || (r.startDate && r.endDate), {
    message: "Choose start and end dates",
    path: ["startDate"],
  })
  .refine((r) => !r.startDate || !r.endDate || r.endDate >= r.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine((r) => !["reimbursement", "refund"].includes(r.kind) || (r.amount ?? 0) > 0, {
    message: "Enter the amount",
    path: ["amount"],
  });
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const REQUEST_KIND_LABELS: Record<StaffRequest["kind"], string> = {
  item: "Item requisition",
  leave: "Leave",
  manpower: "Manpower",
  job: "Job request",
  reimbursement: "Reimbursement",
  confirmation: "Confirmation",
  refund: "Refund",
  "file-reopen": "File reopen",
};

type DecisionListener = (request: StaffRequest) => void;
const listeners: DecisionListener[] = [];

/** Lets other domains (billing refunds, file reopen) react to approvals without a circular import. */
export function onRequestDecided(listener: DecisionListener): void {
  if (!listeners.includes(listener)) listeners.push(listener);
}

export interface RequestState {
  requests: StaffRequest[];
  create: (input: CreateRequestInput) => StaffRequest;
  decide: (id: string, approve: boolean, comment?: string) => StaffRequest;
  reset: (seed?: SeedData) => void;
}

export const useRequestStore = createDomainStore<RequestState>("requests", (set, get) => ({
  requests: seedSlice("requests"),
  create: (input) => {
    const parsed = validate(createRequestSchema, input);
    const request = validate(requestSchema, {
      ...parsed,
      id: newId("REQ"),
      requesterId: currentActorId(),
      status: "pending",
      createdAt: nowIso(),
    });
    set((s) => {
      s.requests.push(request);
    });
    audit(
      "create",
      "request",
      `Submitted ${REQUEST_KIND_LABELS[request.kind].toLowerCase()} request: ${request.title}`,
      request.id,
    );
    return request;
  },
  decide: (id, approve, comment) => {
    const current = get().requests.find((r) => r.id === id);
    if (!current) throw new DomainError("Request not found");
    assert(current.status === "pending", "This request has already been decided");
    const approverId = currentActorId();
    assert(approverId !== current.requesterId, "You cannot approve your own request");
    if (!approve) assert(comment && comment.trim().length >= 3, "Give a short reason when rejecting", "comment");
    const decided: StaffRequest = validate(requestSchema, {
      ...current,
      status: approve ? "approved" : "rejected",
      approverId,
      comment: comment?.trim() || undefined,
      decidedAt: nowIso(),
    });
    set((s) => {
      s.requests[s.requests.findIndex((r) => r.id === id)] = decided;
    });
    const approver = useStaffStore.getState().staff.find((s) => s.id === approverId)?.name ?? "the approver";
    useNotificationStore.getState().push({
      userId: decided.requesterId,
      title: `Request ${decided.status}`,
      body: `${decided.title} was ${decided.status} by ${approver}${decided.comment ? `: “${decided.comment}”` : "."}`,
      href: "/requests",
    });
    audit(
      approve ? "approve" : "reject",
      "request",
      `${approve ? "Approved" : "Rejected"} request: ${decided.title}`,
      id,
    );
    listeners.forEach((l) => l(decided));
    return decided;
  },
  reset: (seed = getSeed()) =>
    set((s) => {
      s.requests = seed.requests;
    }),
}));

export function leaveDaysUsed(requests: readonly StaffRequest[], staffId: string, year: string): number {
  return requests
    .filter(
      (r) =>
        r.kind === "leave" && r.status === "approved" && r.requesterId === staffId && r.startDate?.startsWith(year),
    )
    .reduce((acc, r) => {
      if (!r.startDate || !r.endDate) return acc;
      const days = Math.round((Date.parse(r.endDate) - Date.parse(r.startDate)) / 86_400_000) + 1;
      return acc + days;
    }, 0);
}
