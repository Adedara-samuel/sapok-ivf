import { BRANCHES } from "@/lib/config";
import type { StaffRole } from "@/lib/schemas/admin";
import { createDomainStore } from "@/lib/stores/core";

export interface SessionState {
  userId: string | null;
  role: StaffRole | null;
  branchId: string;
  seedDay: string | null;
  login: (userId: string, role: StaffRole, branchId: string) => void;
  logout: () => void;
  switchRole: (role: StaffRole) => void;
  switchBranch: (branchId: string) => void;
  setSeedDay: (day: string) => void;
}

export const useSessionStore = createDomainStore<SessionState>("session", (set) => ({
  userId: null,
  role: null,
  branchId: BRANCHES[0].id,
  seedDay: null,
  login: (userId, role, branchId) =>
    set((s) => {
      s.userId = userId;
      s.role = role;
      s.branchId = branchId;
    }),
  logout: () =>
    set((s) => {
      s.userId = null;
      s.role = null;
    }),
  switchRole: (role) =>
    set((s) => {
      s.role = role;
    }),
  switchBranch: (branchId) =>
    set((s) => {
      s.branchId = branchId;
    }),
  setSeedDay: (day) =>
    set((s) => {
      s.seedDay = day;
    }),
}));

/** Current actor id for audit events and authorship (falls back to the admin for system actions). */
export function currentActorId(): string {
  return useSessionStore.getState().userId ?? "S18";
}
