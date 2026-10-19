import { z } from "zod";
import { isoDate, isoDateTime, phone } from "@/lib/schemas/common";

export const Plan = z.enum(["starter", "professional", "enterprise"]);
export type Plan = z.infer<typeof Plan>;

export const PLANS: Record<Plan, { label: string; monthly: number; branches: number; ai: boolean }> = {
  starter: { label: "Starter", monthly: 350_000, branches: 1, ai: false },
  professional: { label: "Professional", monthly: 750_000, branches: 5, ai: true },
  enterprise: { label: "Enterprise", monthly: 1_500_000, branches: 50, ai: true },
};

/** Subscription states, derived automatically from the paid-up date (see effectiveStatus). */
export const SubscriptionStatus = z.enum(["active", "grace", "read-only", "suspended"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const NIGERIAN_BANKS = [
  "Access Bank",
  "First Bank of Nigeria",
  "Guaranty Trust Bank",
  "Zenith Bank",
  "United Bank for Africa",
  "Fidelity Bank",
  "Stanbic IBTC Bank",
  "Sterling Bank",
  "Union Bank",
  "Wema Bank",
  "Moniepoint MFB",
  "Providus Bank",
] as const;

export const settlementAccountSchema = z.object({
  bankName: z.enum(NIGERIAN_BANKS, { error: "Choose the bank" }),
  accountNumber: z.string().regex(/^\d{10}$/, "Enter the 10-digit NUBAN account number"),
  accountName: z.string().trim().min(3, "Verify the account to fetch its name"),
});
export type SettlementAccount = z.infer<typeof settlementAccountSchema>;

export const brandingSchema = z.object({
  name: z.string().trim().min(3, "Hospital name needs at least 3 characters").max(60),
  shortName: z.string().trim().min(2, "Short name needs at least 2 characters").max(24),
  tagline: z.string().trim().max(60),
  primaryColor: z.string().regex(HEX_COLOR, "Use a colour like #0F766E"),
  logoDataUrl: z.string().optional(),
  address: z.string().trim().min(5, "Enter the hospital address"),
  city: z.string().trim().min(2, "Enter the city"),
  phone,
  email: z.email("Enter a valid email address"),
});
export type Branding = z.infer<typeof brandingSchema>;

export const tenantSchema = brandingSchema.extend({
  id: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
    .min(3, "At least 3 characters")
    .max(32),
  plan: Plan,
  /** Platform service charge on every gateway payment, in percent (set by the super admin only). */
  feePercent: z.number().min(0, "Cannot be negative").max(10, "Keep the fee at 10% or less"),
  /** Cap per transaction in naira; 0 means no cap. */
  feeCap: z.number().min(0),
  aiEnabled: z.boolean(),
  settlement: settlementAccountSchema,
  /** Paystack subaccount the hospital's share is split to. */
  subaccountCode: z.string().min(3),
  /** Subscription is paid up to and including this date. */
  paidUntil: isoDate,
  /** Manual suspension by the super admin overrides the automatic status. */
  suspended: z.boolean(),
  suspendReason: z.string().optional(),
  dataMode: z.enum(["sample", "empty"]),
  admin: z.object({
    name: z.string().trim().min(3, "Enter the admin's full name"),
    email: z.email("Enter a valid email address"),
    phone,
  }),
  createdAt: isoDateTime,
});
export type Tenant = z.infer<typeof tenantSchema>;

/** Gateway fee model (editable by the super admin; confirm against Paystack's current pricing before go-live). */
export const gatewayFeesSchema = z.object({
  transferPercent: z.number().min(0).max(5),
  transferCap: z.number().min(0),
  cardPercent: z.number().min(0).max(5),
  cardFlat: z.number().min(0),
  cardFlatWaivedBelow: z.number().min(0),
  cardCap: z.number().min(0),
});
export type GatewayFees = z.infer<typeof gatewayFeesSchema>;

export const platformAuditSchema = z.object({
  id: z.string(),
  at: isoDateTime,
  actor: z.string(),
  tenantSlug: z.string().optional(),
  summary: z.string(),
});
export type PlatformAuditEvent = z.infer<typeof platformAuditSchema>;
