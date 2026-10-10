"use client";

import { useCallback, type ReactNode } from "react";
import { hasCapability, type Capability } from "@/lib/permissions";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";

export function usePermission(capability: Capability): boolean {
  const role = useSessionStore((s) => s.role);
  const matrix = useSettingsStore((s) => s.matrix);
  return role ? hasCapability(matrix, role, capability) : false;
}

export function useCan(): (capability: Capability) => boolean {
  const role = useSessionStore((s) => s.role);
  const matrix = useSettingsStore((s) => s.matrix);
  return useCallback(
    (capability: Capability) => (role ? hasCapability(matrix, role, capability) : false),
    [role, matrix],
  );
}

/** Renders children only when the current role has the capability. */
export function Can({
  capability,
  children,
  fallback = null,
}: {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePermission(capability) ? <>{children}</> : <>{fallback}</>;
}
