import { z } from "zod";
import type { StaffRequest } from "@/lib/schemas/admin";
import {
  chargeSchema,
  hmoClaimSchema,
  paymentSchema,
  recordPaymentSchema,
  refundSchema,
  type Charge,
  type HmoClaim,
  type Payment,
  type RecordPaymentInput,
  type Refund,
} from "@/lib/schemas/billing";
import type { PayerCategory } from "@/lib/schemas/common";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { currentActorId } from "@/lib/stores/session";
import { nowIso, todayIso } from "@/lib/utils/dates";
import { newId, nextSequence } from "@/lib/utils/ids";
import { formatMoney } from "@/lib/utils/money";

export const refundRequestSchema = z.object({
  amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero"),
  reason: z.string().min(5, "Explain the refund (at least 5 characters)"),
});
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

export interface AccountSummary {
  charged: number;
  paid: number;
  refunded: number;
  balance: number;
}

export function accountSummary(
  episodeId: string,
  charges: readonly Charge[],
  payments: readonly Payment[],
  refunds: readonly Refund[],
): AccountSummary {
  const charged = charges
    .filter((c) => c.episodeId === episodeId && c.status !== "waived")
    .reduce((s, c) => s + c.amount, 0);
  const paid = payments.filter((p) => p.episodeId === episodeId).reduce((s, p) => s + p.amount, 0);
  const refunded = refunds
    .filter((r) => r.episodeId === episodeId && r.status === "approved")
    .reduce((s, r) => s + r.amount, 0);
  return { charged, paid, refunded, balance: charged - paid + refunded };
}

/** Allocate unallocated credit on an account to outstanding charges, oldest first. */
function allocateCredit(charges: Charge[], episodeId: string, credit: number): void {
  let remaining = credit;
  charges
    .filter((c) => c.episodeId === episodeId && (c.status === "unpaid" || c.status === "part-paid"))
    .sort((a, b) => a.at.localeCompare(b.at))
    .forEach((c) => {
      if (remaining <= 0) return;
      const take = Math.min(c.amount - c.paid, remaining);
      c.paid += take;
      remaining -= take;
      c.status = c.paid >= c.amount ? "paid" : c.paid > 0 ? "part-paid" : "unpaid";
    });
}

function unallocated(
  charges: readonly Charge[],
  payments: readonly Payment[],
  refunds: readonly Refund[],
  episodeId: string,
): number {
  const paid = payments.filter((p) => p.episodeId === episodeId).reduce((s, p) => s + p.amount, 0);
  const refunded = refunds
    .filter((r) => r.episodeId === episodeId && r.status === "approved")
    .reduce((s, r) => s + r.amount, 0);
  const allocated = charges.filter((c) => c.episodeId === episodeId).reduce((s, c) => s + c.paid, 0);
  return Math.max(0, paid - refunded - allocated);
}

export interface BillingState {
  charges: Charge[];
  payments: Payment[];
  refunds: Refund[];
  claims: HmoClaim[];
  addCharge: (input: {
    episodeId: string;
    orderId?: string;
    description: string;
    department: Charge["department"];
    amount: number;
    payer: PayerCategory;
  }) => Charge;
  waiveForOrder: (orderId: string) => void;
  recordPayment: (episodeId: string, input: RecordPaymentInput, receiptPrefix?: string) => Payment;
  createRefund: (episodeId: string, input: RefundRequestInput, requestId: string) => Refund;
  applyRefundDecision: (request: StaffRequest) => void;
  submitClaim: (episodeId: string, hmo: string, amount: number) => HmoClaim;
  decideClaim: (id: string, status: "approved" | "rejected") => void;
  reset: (seed: SeedData) => void;
}

export const useBillingStore = createDomainStore<BillingState>("billing", (set, get) => ({
  charges: [],
  payments: [],
  refunds: [],
  claims: [],
  addCharge: (input) => {
    const charge = validate(chargeSchema, { ...input, id: newId("CHG"), paid: 0, status: "unpaid", at: nowIso() });
    set((s) => {
      s.charges.push(charge);
      const credit = unallocated(s.charges, s.payments, s.refunds, charge.episodeId);
      if (credit > 0) allocateCredit(s.charges, charge.episodeId, credit);
    });
    audit("create", "charge", `Charged ${charge.description} (${formatMoney(charge.amount)})`, charge.episodeId);
    return charge;
  },
  waiveForOrder: (orderId) => {
    const charge = get().charges.find((c) => c.orderId === orderId);
    if (!charge) return;
    set((s) => {
      const c = s.charges.find((x) => x.id === charge.id);
      if (c) {
        c.status = "waived";
        c.paid = 0;
      }
      const credit = unallocated(s.charges, s.payments, s.refunds, charge.episodeId);
      if (credit > 0) allocateCredit(s.charges, charge.episodeId, credit);
    });
    audit("cancel", "charge", `Waived charge for cancelled order (${charge.description})`, charge.episodeId);
  },
  recordPayment: (episodeId, input, receiptPrefix = "RCP") => {
    const parsed = validate(recordPaymentSchema, input);
    if (parsed.method === "transfer" || parsed.method === "pos")
      assert(parsed.reference && parsed.reference.trim().length >= 4, "Enter the transfer/POS reference", "reference");
    const payment = validate(paymentSchema, {
      ...parsed,
      id: newId("PAY"),
      episodeId,
      receiptNo: nextSequence(
        get().payments.map((p) => p.receiptNo),
        `${receiptPrefix}-`,
        6,
      ),
      receivedBy: currentActorId(),
      at: nowIso(),
    });
    set((s) => {
      s.payments.push(payment);
      allocateCredit(s.charges, episodeId, unallocated(s.charges, s.payments, s.refunds, episodeId));
    });
    audit(
      "create",
      "payment",
      `Received ${formatMoney(payment.amount)} by ${payment.method} — ${payment.receiptNo}`,
      episodeId,
    );
    return payment;
  },
  createRefund: (episodeId, input, requestId) => {
    const parsed = validate(refundRequestSchema, input);
    const summary = accountSummary(episodeId, get().charges, get().payments, get().refunds);
    const pending = get()
      .refunds.filter((r) => r.episodeId === episodeId && r.status === "pending")
      .reduce((s, r) => s + r.amount, 0);
    const refundable = summary.paid - summary.refunded - pending;
    assert(
      parsed.amount <= refundable,
      `Refund cannot exceed ${formatMoney(Math.max(0, refundable))} paid on this account`,
      "amount",
    );
    const refund = validate(refundSchema, {
      ...parsed,
      id: newId("RFD"),
      episodeId,
      status: "pending",
      requestId,
      requestedBy: currentActorId(),
      at: nowIso(),
    });
    set((s) => {
      s.refunds.push(refund);
    });
    audit("create", "refund", `Requested refund of ${formatMoney(refund.amount)}`, episodeId);
    return refund;
  },
  applyRefundDecision: (request) => {
    if (request.kind !== "refund") return;
    const refund = get().refunds.find((r) => r.requestId === request.id);
    if (!refund || refund.status !== "pending") return;
    set((s) => {
      const r = s.refunds.find((x) => x.id === refund.id);
      if (!r) return;
      r.status = request.status === "approved" ? "approved" : "rejected";
      if (r.status === "approved") {
        // reverse allocations so balances stay consistent
        let toRelease =
          r.amount -
          unallocated(
            s.charges,
            s.payments,
            s.refunds.filter((x) => x.id !== r.id),
            r.episodeId,
          );
        s.charges
          .filter((c) => c.episodeId === r.episodeId && c.paid > 0)
          .sort((a, b) => b.at.localeCompare(a.at))
          .forEach((c) => {
            if (toRelease <= 0) return;
            const back = Math.min(c.paid, toRelease);
            c.paid -= back;
            toRelease -= back;
            c.status = c.paid >= c.amount ? "paid" : c.paid > 0 ? "part-paid" : "unpaid";
          });
      }
    });
    audit("update", "refund", `Refund ${request.status}: ${formatMoney(refund.amount)}`, refund.episodeId);
  },
  submitClaim: (episodeId, hmo, amount) => {
    assert(amount > 0, "Nothing to claim on this account");
    const claim = validate(hmoClaimSchema, {
      id: newId("CLM"),
      episodeId,
      hmo,
      amount,
      status: "submitted",
      submittedAt: todayIso(),
    });
    set((s) => {
      s.claims.push(claim);
    });
    audit("create", "claim", `Submitted HMO claim to ${hmo} for ${formatMoney(amount)}`, episodeId);
    return claim;
  },
  decideClaim: (id, status) => {
    const claim = get().claims.find((c) => c.id === id);
    if (!claim) throw new DomainError("Claim not found");
    assert(claim.status === "submitted", "This claim has already been decided");
    set((s) => {
      const c = s.claims.find((x) => x.id === id);
      if (c) {
        c.status = status;
        c.decidedAt = todayIso();
      }
    });
    audit(status === "approved" ? "approve" : "reject", "claim", `HMO claim ${status} (${claim.hmo})`, claim.episodeId);
  },
  reset: (seed) =>
    set((s) => {
      s.charges = seed.charges;
      s.payments = seed.payments;
      s.refunds = seed.refunds;
      s.claims = seed.claims;
    }),
}));
