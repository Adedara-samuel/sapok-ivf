import { staffSchema, type Staff } from "@/lib/schemas/admin";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { nextSequence } from "@/lib/utils/ids";

export type StaffInput = Omit<Staff, "id">;

export interface StaffState {
  staff: Staff[];
  add: (input: StaffInput) => Staff;
  update: (id: string, patch: Partial<StaffInput>) => Staff;
  setActive: (id: string, active: boolean) => void;
  reset: (seed: SeedData) => void;
}

export const useStaffStore = createDomainStore<StaffState>("staff", (set, get) => ({
  staff: [],
  add: (input) => {
    if (get().staff.some((s) => s.email.toLowerCase() === input.email.toLowerCase()))
      throw new DomainError("A user with this email already exists", {
        email: "A user with this email already exists",
      });
    const member = validate(staffSchema, {
      ...input,
      id: nextSequence(
        get().staff.map((s) => s.id),
        "S",
        2,
      ),
    });
    set((s) => {
      s.staff.push(member);
    });
    audit("create", "user", `Added user ${member.name} (${member.role})`, member.id);
    return member;
  },
  update: (id, patch) => {
    const current = get().staff.find((s) => s.id === id);
    if (!current) throw new DomainError("User not found");
    const next = validate(staffSchema, { ...current, ...patch });
    set((s) => {
      s.staff[s.staff.findIndex((x) => x.id === id)] = next;
    });
    audit("update", "user", `Updated user ${next.name}`, id);
    return next;
  },
  setActive: (id, active) => {
    const current = get().staff.find((s) => s.id === id);
    if (!current) throw new DomainError("User not found");
    if (current.role === "admin" && !active && get().staff.filter((s) => s.role === "admin" && s.active).length <= 1)
      throw new DomainError("At least one active admin is required");
    set((s) => {
      const m = s.staff.find((x) => x.id === id);
      if (m) m.active = active;
    });
    audit("update", "user", `${active ? "Reactivated" : "Deactivated"} user ${current.name}`, id);
  },
  reset: (seed) =>
    set((s) => {
      s.staff = seed.staff;
    }),
}));

export function staffName(staff: readonly Staff[], id: string | undefined): string {
  if (!id) return "—";
  return staff.find((s) => s.id === id)?.name ?? id;
}
