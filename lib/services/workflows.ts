import type { Staff, StaffRequest, StaffRole } from "@/lib/schemas/admin";
import { audit } from "@/lib/stores/audit";
import { useBillingStore, type RefundRequestInput } from "@/lib/stores/billing";
import { assert, assertWritable, DomainError } from "@/lib/stores/core";
import { useWalletStore } from "@/lib/stores/wallet";
import { useCycleStore } from "@/lib/stores/cycle";
import { useEmbryologyStore } from "@/lib/stores/embryology";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useOrderStore, type PlaceOrderInput } from "@/lib/stores/orders";
import { usePersonStore } from "@/lib/stores/person";
import { useProcedureStore } from "@/lib/stores/procedure";
import { useRequestStore } from "@/lib/stores/requests";
import { useSessionStore } from "@/lib/stores/session";
import { formatMoney } from "@/lib/utils/money";
import { shiftDate } from "@/lib/utils/dates";
import type { Order } from "@/lib/schemas/orders";
import type { Procedure } from "@/lib/schemas/procedure";

export function signIn(staff: Staff): void {
  assert(staff.active, "This account has been deactivated. Contact an administrator.");
  useSessionStore.getState().login(staff.id, staff.role, staff.branchId);
  audit("login", "session", `Signed in as ${staff.name} (${staff.role})`, staff.id);
}

export function signOut(): void {
  const { userId } = useSessionStore.getState();
  if (userId) audit("login", "session", "Signed out", userId);
  useSessionStore.getState().logout();
}

export function switchRole(role: StaffRole): void {
  useSessionStore.getState().switchRole(role);
  audit("update", "session", `Demo role switched to ${role}`);
}

export function switchBranch(branchId: string, name: string): void {
  useSessionStore.getState().switchBranch(branchId);
  audit("update", "session", `Switched branch to ${name}`);
}

function payerForEpisode(episodeId: string) {
  const episode = useEpisodeStore.getState().episodes.find((e) => e.id === episodeId);
  if (!episode) throw new DomainError("Episode not found");
  assert(episode.status !== "closed", "This file is closed. Reopen it before adding orders.");
  const patient = usePersonStore.getState().persons.find((p) => p.id === episode.patientId);
  return patient?.payer.category ?? "self-pay";
}

/**
 * Places an order and raises its charge in one step (orders always create charges). If the patient belongs to an
 * account with auto-debit on, the charge is paid from that account immediately.
 */
export function placeOrder(episodeId: string, input: PlaceOrderInput): Order {
  assertWritable();
  const payer = payerForEpisode(episodeId);
  const order = useOrderStore.getState().place(episodeId, input);
  useBillingStore.getState().addCharge({
    episodeId,
    orderId: order.id,
    description: `${order.name}${order.qty > 1 ? ` × ${order.qty}` : ""}`,
    department: order.kind,
    amount: order.amount,
    payer,
  });
  useWalletStore.getState().autoDebitEpisode(episodeId);
  return order;
}

/** Cancels an order, waives its charge, and returns anything the patient account already paid for it. */
export function cancelOrder(orderId: string, reason: string): Order {
  assertWritable();
  const order = useOrderStore.getState().cancel(orderId, reason);
  useBillingStore.getState().waiveForOrder(orderId);
  useWalletStore.getState().returnEpisodeCredit(order.episodeId, `${order.name} cancelled`);
  return order;
}

/** Refunds go through the approvals engine: request first, refund applied on approval. */
export function requestRefund(episodeId: string, input: RefundRequestInput): StaffRequest {
  const episode = useEpisodeStore.getState().episodes.find((e) => e.id === episodeId);
  if (!episode) throw new DomainError("Episode not found");
  const billing = useBillingStore.getState();
  // validate the amount before creating the approval request
  const paid = billing.payments.filter((p) => p.episodeId === episodeId).reduce((s, p) => s + p.amount, 0);
  const committed = billing.refunds
    .filter((r) => r.episodeId === episodeId && r.status !== "rejected")
    .reduce((s, r) => s + r.amount, 0);
  assert(
    input.amount > 0 && input.amount <= paid - committed,
    `Refund cannot exceed ${formatMoney(Math.max(0, paid - committed))} paid on this account`,
    "amount",
  );
  const request = useRequestStore.getState().create({
    kind: "refund",
    title: `Refund ${formatMoney(input.amount)} — ${episode.ivfNo}`,
    details: input.reason,
    amount: input.amount,
    entityId: episodeId,
  });
  billing.createRefund(episodeId, input, request.id);
  return request;
}

export function requestFileReopen(episodeId: string, reason: string): StaffRequest {
  const episode = useEpisodeStore.getState().episodes.find((e) => e.id === episodeId);
  if (!episode) throw new DomainError("Episode not found");
  assert(episode.status === "closed", "This file is not closed");
  const pending = useRequestStore
    .getState()
    .requests.find((r) => r.kind === "file-reopen" && r.entityId === episodeId && r.status === "pending");
  assert(!pending, "A reopen request is already awaiting approval");
  return useRequestStore
    .getState()
    .create({ kind: "file-reopen", title: `Reopen file ${episode.ivfNo}`, details: reason, entityId: episodeId });
}

/** Signs and posts a procedure note and moves the cycle forward where appropriate. */
export function postProcedure(procedureId: string, signatureDataUrl: string): Procedure {
  const posted = useProcedureStore.getState().post(procedureId, signatureDataUrl);
  const cycles = useCycleStore.getState();
  const cycle = cycles.cycles.find((c) => c.id === posted.cycleId);
  if (!cycle || cycle.stage === "completed" || cycle.stage === "cancelled") return posted;
  if (posted.type === "OCR" && posted.count !== undefined && !cycle.ocr) {
    cycles.setOcr(cycle.id, { eggs: posted.count, mii: 0, fertilised: 0 });
  }
  if (posted.type === "ET" || posted.type === "FET") {
    const ids = cycle.transferPlan?.embryoIds ?? [];
    if (ids.length > 0) useEmbryologyStore.getState().recordTransfer(ids, `${posted.type} on ${posted.date}`);
    cycles.setStage(cycle.id, "luteal");
    if (!cycle.betaHcg?.value) {
      useCycleStore.setState((s) => {
        const c = s.cycles.find((x) => x.id === cycle.id);
        if (c) c.betaHcg = { date: shiftDate(posted.date, 11) };
      });
    }
  }
  return posted;
}

export function logSensitiveView(entity: string, summary: string, entityId?: string): void {
  audit("view", entity, summary, entityId);
}
