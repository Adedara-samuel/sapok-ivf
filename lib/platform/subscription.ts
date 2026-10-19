import type { SubscriptionStatus, Tenant } from "@/lib/schemas/platform";
import { daysBetween } from "@/lib/utils/dates";

export const GRACE_DAYS = 7;
export const READ_ONLY_DAYS = 30;

/**
 * Subscription status is never set by hand: it follows from the date the hospital is paid up to.
 * Paid up → active; up to 7 days late → grace (banner); up to 30 days late → read-only; later → suspended.
 * A manual suspension by the super admin overrides everything.
 */
export function effectiveStatus(tenant: Pick<Tenant, "paidUntil" | "suspended">, today: string): SubscriptionStatus {
  if (tenant.suspended) return "suspended";
  const late = daysBetween(tenant.paidUntil, today);
  if (late <= 0) return "active";
  if (late <= GRACE_DAYS) return "grace";
  if (late <= READ_ONLY_DAYS) return "read-only";
  return "suspended";
}

export function daysLate(tenant: Pick<Tenant, "paidUntil">, today: string): number {
  return Math.max(0, daysBetween(tenant.paidUntil, today));
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  grace: "Payment overdue (grace)",
  "read-only": "Read-only",
  suspended: "Suspended",
};

export function statusMessage(tenant: Tenant, today: string): string | null {
  const status = effectiveStatus(tenant, today);
  const late = daysLate(tenant, today);
  if (status === "grace")
    return `Subscription payment is ${late} day${late === 1 ? "" : "s"} overdue. Everything works for ${GRACE_DAYS - late} more day${GRACE_DAYS - late === 1 ? "" : "s"}, then the system becomes read-only.`;
  if (status === "read-only")
    return "Subscription payment is overdue, so the system is read-only: records can be viewed and printed, but not changed. Contact Overcare to renew.";
  if (status === "suspended")
    return tenant.suspended && tenant.suspendReason
      ? `Access to this hospital is suspended: ${tenant.suspendReason}`
      : "Access to this hospital is suspended. Contact Overcare support to restore it.";
  return null;
}
