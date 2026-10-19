import { z } from "zod";
import { id, isoDateTime, money } from "@/lib/schemas/common";

/**
 * Patient and family accounts (wallets).
 *
 * Money a patient or family pays goes into the hospital's bank account (through the payment gateway), and the
 * wallet is the hospital's record of how much of it is still unspent. When the patient is billed, the wallet is
 * debited automatically. Every movement is an append-only ledger entry; the balance is always the sum of the
 * entries and is never stored on its own.
 */

export const WalletKind = z.enum(["individual", "family"]);
export type WalletKind = z.infer<typeof WalletKind>;

export const WalletStatus = z.enum(["active", "frozen", "closed"]);
export type WalletStatus = z.infer<typeof WalletStatus>;

export const RELATIONSHIPS = [
  "Self",
  "Wife",
  "Husband",
  "Partner",
  "Daughter",
  "Son",
  "Sister",
  "Brother",
  "Mother",
  "Father",
  "Relative",
  "Sponsor",
] as const;

export const walletMemberSchema = z.object({
  personId: id,
  relationship: z.enum(RELATIONSHIPS),
  addedAt: isoDateTime,
  addedBy: id,
});
export type WalletMember = z.infer<typeof walletMemberSchema>;

/** Dedicated bank account number issued by the gateway (Paystack Dedicated Virtual Account). */
export const virtualAccountSchema = z.object({
  provider: z.literal("paystack"),
  bankName: z.string().min(2),
  accountNumber: z.string().regex(/^\d{10}$/, "Account numbers have 10 digits"),
  accountName: z.string().min(3),
  customerCode: z.string().min(3),
  assignedAt: isoDateTime,
});
export type VirtualAccount = z.infer<typeof virtualAccountSchema>;

export const walletConsentSchema = z.object({
  signerName: z.string().min(3, "Enter the account holder's full name"),
  signatureDataUrl: z.string().min(1, "A signature is required"),
  signedAt: isoDateTime,
});
export type WalletConsent = z.infer<typeof walletConsentSchema>;

export const walletSchema = z.object({
  id,
  /** Human code shown on statements: FAM-000012 or IND-000045. */
  code: z.string().min(1),
  kind: WalletKind,
  name: z.string().min(3, "Give the account a name (at least 3 characters)"),
  holderId: id,
  members: z.array(walletMemberSchema).min(1),
  virtualAccount: virtualAccountSchema.optional(),
  /** Only the last 4 digits are kept; the full BVN goes to the gateway and is never stored. */
  bvnLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  autoDebit: z.boolean(),
  /** How far below zero the account may go (₦0 = no debt). Raised per family by a hospital admin. */
  creditLimit: money,
  lowBalanceAlert: money,
  consent: walletConsentSchema.optional(),
  status: WalletStatus,
  branchId: id,
  createdAt: isoDateTime,
  createdBy: id,
});
export type Wallet = z.infer<typeof walletSchema>;

export const LedgerKind = z.enum(["deposit", "charge", "reversal", "withdrawal"]);
export type LedgerKind = z.infer<typeof LedgerKind>;

export const DepositChannel = z.enum(["bank-transfer", "card", "cash", "pos"]);
export type DepositChannel = z.infer<typeof DepositChannel>;

export const ledgerEntrySchema = z.object({
  id,
  walletId: id,
  kind: LedgerKind,
  direction: z.enum(["credit", "debit"]),
  amount: z.number().positive(),
  /** Balance immediately after this entry, for statements. */
  balanceAfter: z.number(),
  description: z.string().min(1),
  channel: DepositChannel.optional(),
  /** Gateway transaction reference; a reference is only ever credited once. */
  gatewayRef: z.string().optional(),
  personId: id.optional(),
  episodeId: id.optional(),
  paymentId: id.optional(),
  chargeIds: z.array(id).optional(),
  requestId: id.optional(),
  at: isoDateTime,
  by: id,
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

/**
 * Where a deposit's money went. The patient's wallet is always credited with the full amount; gateway and
 * platform fees come out of the hospital's settlement, never out of the patient's balance.
 */
export const settlementSchema = z.object({
  id,
  walletId: id,
  entryId: id,
  channel: DepositChannel,
  gatewayRef: z.string().optional(),
  gross: money,
  gatewayFee: money,
  platformFee: money,
  hospitalNet: money,
  feePercent: z.number().nonnegative(),
  status: z.enum(["settled", "pending", "collected-at-desk"]),
  at: isoDateTime,
  settledAt: isoDateTime.optional(),
});
export type Settlement = z.infer<typeof settlementSchema>;

export const walletMessageSchema = z.object({
  id,
  walletId: id,
  channel: z.enum(["whatsapp", "sms", "email"]),
  to: z.string(),
  body: z.string(),
  at: isoDateTime,
});
export type WalletMessage = z.infer<typeof walletMessageSchema>;
