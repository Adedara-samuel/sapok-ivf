"use client";

import { useMemo } from "react";
import { fullName } from "@/lib/schemas/person";
import { usePersonStore } from "@/lib/stores/person";
import { useStaffStore } from "@/lib/stores/staff";

/** Memoised id → display-name lookups for staff and people. */
export function useLookups() {
  const staff = useStaffStore((s) => s.staff);
  const persons = usePersonStore((s) => s.persons);
  return useMemo(() => {
    const staffMap = new Map(staff.map((s) => [s.id, s]));
    const personMap = new Map(persons.map((p) => [p.id, p]));
    return {
      staffName: (id?: string) => (id ? (staffMap.get(id)?.name ?? id) : "—"),
      person: (id?: string) => (id ? personMap.get(id) : undefined),
      personName: (id?: string) => {
        const p = id ? personMap.get(id) : undefined;
        return p ? fullName(p) : "—";
      },
      staff,
      persons,
    };
  }, [staff, persons]);
}
