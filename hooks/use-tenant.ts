"use client";

import { useMemo } from "react";
import type { SubscriptionStatus, Tenant } from "@/lib/schemas/platform";
import { effectiveStatus, statusMessage } from "@/lib/platform/subscription";
import { usePlatformStore } from "@/lib/stores/platform";
import { activeTenantSlug } from "@/lib/tenancy";
import { todayIso } from "@/lib/utils/dates";

/** The hospital loaded in this tab (its record lives in the shared platform store). */
export function useActiveTenant(): Tenant | undefined {
  const tenants = usePlatformStore((s) => s.tenants);
  return useMemo(() => {
    const slug = activeTenantSlug();
    return tenants.find((t) => t.slug === slug);
  }, [tenants]);
}

export function useSubscription(): { status: SubscriptionStatus; message: string | null; tenant?: Tenant } {
  const tenant = useActiveTenant();
  return useMemo(() => {
    if (!tenant) return { status: "active", message: null };
    const today = todayIso();
    return { status: effectiveStatus(tenant, today), message: statusMessage(tenant, today), tenant };
  }, [tenant]);
}
