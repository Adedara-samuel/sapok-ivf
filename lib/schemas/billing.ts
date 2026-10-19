import { z } from "zod";
import { id, isoDate, isoDateTime, money, PayerCategory } from "@/lib/schemas/common";

export const ChargeStatus = z.enum(["unpaid", "part-paid", "paid", "waived"]);
export type ChargeStatus = z.infer<typeof ChargeStatus>;

export const chargeSchema = z.object({
  id,
  episodeId: id,
  orderId: id.optional(),
  description: z.string().min(1),
  department: z.enum(["lab", "radiology", "pharmacy", "service"]),
  amount: money,
  paid: money,
  payer: PayerCategory,
  status: ChargeStatus,
  at: isoDateTime,
});
export type Charge = z.infer<typeof chargeSchema>;

export const PaymentMethod = z.enum(["cash", "transfer", "pos", "hmo", "deposit", "wallet"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** Methods a cashier can record by hand (wallet payments are made automatically from a patient account). */
export const DESK_PAYMENT_METHODS = PaymentMethod.options.filter((m) => m !== "wallet");

export const paymentSchema = z.object({
  id,
  episodeId: id,
  amount: z.number().positive("Enter an amount greater than zero"),
  method: PaymentMethod,
  reference: z.string().optional(),
  receiptNo: z.string(),
  receivedBy: id,
  at: isoDateTime,
});
export type Payment = z.infer<typeof paymentSchema>;

export const refundSchema = z.object({
  id,
  episodeId: id,
  amount: z.number().positive("Enter an amount greater than zero"),
  reason: z.string().min(5, "Explain the refund (at least 5 characters)"),
  status: z.enum(["pending", "approved", "rejected"]),
  /** Approval request; absent for automatic returns to a patient account (e.g. a cancelled order). */
  requestId: id.optional(),
  /** Where the money goes: back to the patient in cash/transfer, or back into their account (wallet). */
  destination: z.enum(["cash", "wallet"]).optional(),
  requestedBy: id,
  at: isoDateTime,
});
export type Refund = z.infer<typeof refundSchema>;

export const hmoClaimSchema = z.object({
  id,
  episodeId: id,
  hmo: z.string(),
  amount: money,
  status: z.enum(["submitted", "approved", "rejected"]),
  submittedAt: isoDate,
  decidedAt: isoDate.optional(),
});
export type HmoClaim = z.infer<typeof hmoClaimSchema>;

export const recordPaymentSchema = z.object({
  amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero"),
  method: PaymentMethod,
  reference: z.string().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
