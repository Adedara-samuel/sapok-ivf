import { counsellingSchema, type Counselling } from "@/lib/schemas/counselling";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { createDomainStore, validate } from "@/lib/stores/core";
import { currentActorId } from "@/lib/stores/session";
import { newId } from "@/lib/utils/ids";

export type CounsellingInput = Omit<Counselling, "id" | "counsellorId">;

export interface CounsellingState {
  records: Counselling[];
  add: (input: CounsellingInput) => Counselling;
  reset: (seed: SeedData) => void;
}

export const useCounsellingStore = createDomainStore<CounsellingState>("counselling", (set) => ({
  records: [],
  add: (input) => {
    const record = validate(counsellingSchema, { ...input, id: newId("CNS"), counsellorId: currentActorId() });
    set((s) => {
      s.records.push(record);
    });
    audit("create", "counselling", `Added counselling note (${record.clientType})`, record.personId);
    return record;
  },
  reset: (seed) =>
    set((s) => {
      s.records = seed.counselling;
    }),
}));
