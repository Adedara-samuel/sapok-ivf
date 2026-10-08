import { z } from "zod";
import { APP_CONFIG } from "@/lib/config";
import {
  cultureLogSchema,
  custodyEventSchema,
  embryoSchema,
  EMBRYO_STAGES,
  positionCode,
  storagePositionSchema,
  type CultureLog,
  type CustodyEvent,
  type Embryo,
  type EmbryoStatus,
  type StoragePosition,
} from "@/lib/schemas/embryology";
import { getSeed, seedSlice } from "@/lib/seed/build";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { currentActorId } from "@/lib/stores/session";
import { useStaffStore } from "@/lib/stores/staff";
import { nowIso, shiftDate, todayIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export const witnessSchema = z.object({
  witnessId: z.string().min(1, "Choose the witnessing embryologist"),
  pin: z.string().min(4, "Enter the witness PIN"),
});
export type WitnessInput = z.infer<typeof witnessSchema>;

export const slotSchema = z.object({
  tank: z.string().min(1),
  canister: z.number().int().min(1).max(6),
  goblet: z.string().min(1),
  straw: z.number().int().min(1).max(10),
});
export type SlotInput = z.infer<typeof slotSchema>;

export const gradeSchema = z.object({
  day: z.number().int().min(0).max(7),
  grade: z.string().min(1, "Enter a grade, e.g. 4AA").max(16),
});

/** Verifies the two-person witness check; returns the witness id. */
function verifyWitness(input: WitnessInput): string {
  const w = validate(witnessSchema, input);
  const actor = currentActorId();
  assert(w.witnessId !== actor, "The witness must be a different person", "witnessId");
  const witness = useStaffStore.getState().staff.find((s) => s.id === w.witnessId);
  assert(
    witness && witness.role === "embryologist" && witness.active,
    "The witness must be an active embryologist",
    "witnessId",
  );
  assert(w.pin === APP_CONFIG.witnessPin, "Witness PIN is incorrect", "pin");
  return w.witnessId;
}

export interface EmbryologyState {
  embryos: Embryo[];
  storage: StoragePosition[];
  cultureLogs: CultureLog[];
  custody: CustodyEvent[];
  addEmbryos: (cycleId: string, count: number, source: Embryo["source"]) => Embryo[];
  grade: (embryoId: string, input: z.infer<typeof gradeSchema>) => void;
  setStatus: (
    embryoId: string,
    status: Exclude<EmbryoStatus, "cryopreserved" | "thawed">,
    witness: WitnessInput,
    note?: string,
  ) => void;
  freeze: (embryoId: string, slot: SlotInput, witness: WitnessInput, consentMonths?: number) => StoragePosition;
  thaw: (embryoId: string, witness: WitnessInput) => void;
  move: (positionId: string, slot: SlotInput, witness: WitnessInput) => void;
  addCultureLog: (cycleId: string, input: { day: number; note: string; incubator: string }) => CultureLog;
  renewConsent: (positionId: string, months: number) => void;
  recordTransfer: (embryoIds: string[], procedureLabel: string) => void;
  reset: (seed?: SeedData) => void;
}

export const useEmbryologyStore = createDomainStore<EmbryologyState>("embryology", (set, get) => {
  const custody = (itemId: string, action: CustodyEvent["action"], detail: string, witnessId: string): CustodyEvent =>
    validate(custodyEventSchema, {
      id: newId("CUS"),
      itemId,
      action,
      detail,
      at: nowIso(),
      by: currentActorId(),
      witnessId,
    });
  const findEmbryo = (id: string): Embryo => {
    const e = get().embryos.find((x) => x.id === id);
    if (!e) throw new DomainError("Embryo not found");
    return e;
  };
  const assertSlotFree = (slot: SlotInput, ignoreId?: string) => {
    const taken = get().storage.find(
      (p) =>
        p.id !== ignoreId &&
        p.tank === slot.tank &&
        p.canister === slot.canister &&
        p.goblet === slot.goblet &&
        p.straw === slot.straw,
    );
    assert(!taken, `Position ${positionCode(slot)} is already occupied`, "straw");
  };
  return {
    embryos: seedSlice("embryos"),
    storage: seedSlice("storage"),
    cultureLogs: seedSlice("cultureLogs"),
    custody: seedSlice("custody"),
    addEmbryos: (cycleId, count, source) => {
      assert(Number.isInteger(count) && count > 0 && count <= 30, "Enter between 1 and 30 oocytes/zygotes", "count");
      const existing = get().embryos.filter((e) => e.cycleId === cycleId).length;
      const created = Array.from({ length: count }, (_, i) =>
        validate(embryoSchema, {
          id: newId("EMB"),
          cycleId,
          label: `E${existing + i + 1}`,
          source,
          day: 0,
          stage: EMBRYO_STAGES[0],
          status: "culturing",
        }),
      );
      set((s) => {
        s.embryos.push(...created);
      });
      audit("create", "embryo", `Logged ${count} oocyte(s) for culture`, cycleId);
      return created;
    },
    grade: (embryoId, input) => {
      const e = findEmbryo(embryoId);
      assert(e.status === "culturing", "Only embryos in culture can be graded");
      const g = validate(gradeSchema, input);
      assert(g.day >= e.day, "Grading day cannot go backwards", "day");
      set((s) => {
        const x = s.embryos.find((y) => y.id === embryoId);
        if (x) {
          x.day = g.day;
          x.grade = g.grade.toUpperCase().replace("CELL", "cell");
          x.stage = EMBRYO_STAGES[g.day] ?? x.stage;
        }
        s.custody.push(custody(embryoId, "graded", `D${g.day} graded ${g.grade}`, currentActorId()));
      });
      audit("update", "embryo", `Graded ${e.label} as ${g.grade} on D${g.day}`, embryoId);
    },
    setStatus: (embryoId, status, witness, note) => {
      const e = findEmbryo(embryoId);
      assert(
        e.status === "culturing" || (status === "transferred" && e.status === "thawed"),
        `Cannot change an embryo that is ${e.status}`,
      );
      const witnessId = verifyWitness(witness);
      set((s) => {
        const x = s.embryos.find((y) => y.id === embryoId);
        if (x) x.status = status;
        s.custody.push(
          custody(
            embryoId,
            status === "transferred" ? "transferred" : status === "discarded" ? "discarded" : "status",
            note ?? `Status → ${status}`,
            witnessId,
          ),
        );
      });
      audit("sign", "embryo", `${e.label} marked ${status} (witnessed)`, embryoId);
    },
    freeze: (embryoId, slotInput, witness, consentMonths = 12) => {
      const e = findEmbryo(embryoId);
      assert(e.status === "culturing", "Only embryos in culture can be vitrified");
      assert(e.day >= 3, "Vitrify at cleavage (D3) or blastocyst stage", "day");
      const slot = validate(slotSchema, slotInput);
      assertSlotFree(slot);
      const witnessId = verifyWitness(witness);
      const today = todayIso();
      const position = validate(storagePositionSchema, {
        id: newId("POS"),
        ...slot,
        itemKind: "embryo",
        itemId: embryoId,
        label: `${e.label} ${e.grade ?? ""}`.trim(),
        storedAt: today,
        consentExpiry: shiftDate(today, Math.round(consentMonths * 30.4)),
      });
      set((s) => {
        s.storage.push(position);
        const x = s.embryos.find((y) => y.id === embryoId);
        if (x) {
          x.status = "cryopreserved";
          x.storagePositionId = position.id;
        }
        s.custody.push(custody(embryoId, "stored", `Vitrified to ${positionCode(slot)}`, witnessId));
      });
      audit("sign", "embryo", `Vitrified ${e.label} to ${positionCode(slot)} (witnessed)`, embryoId);
      return position;
    },
    thaw: (embryoId, witness) => {
      const e = findEmbryo(embryoId);
      assert(e.status === "cryopreserved", "Only cryopreserved embryos can be warmed");
      const witnessId = verifyWitness(witness);
      const pos = get().storage.find((p) => p.id === e.storagePositionId);
      set((s) => {
        s.storage = s.storage.filter((p) => p.id !== e.storagePositionId);
        const x = s.embryos.find((y) => y.id === embryoId);
        if (x) {
          x.status = "thawed";
          x.storagePositionId = undefined;
        }
        s.custody.push(custody(embryoId, "thawed", `Warmed from ${pos ? positionCode(pos) : "storage"}`, witnessId));
      });
      audit("sign", "embryo", `Warmed ${e.label} (witnessed)`, embryoId);
    },
    move: (positionId, slotInput, witness) => {
      const pos = get().storage.find((p) => p.id === positionId);
      if (!pos) throw new DomainError("Storage position not found");
      const slot = validate(slotSchema, slotInput);
      assertSlotFree(slot, positionId);
      const witnessId = verifyWitness(witness);
      set((s) => {
        const p = s.storage.find((x) => x.id === positionId);
        if (p) Object.assign(p, slot);
        s.custody.push(
          custody(pos.itemId ?? positionId, "moved", `Moved ${positionCode(pos)} → ${positionCode(slot)}`, witnessId),
        );
      });
      audit("sign", "storage", `Moved ${pos.label} to ${positionCode(slot)} (witnessed)`, positionId);
    },
    addCultureLog: (cycleId, input) => {
      const log = validate(cultureLogSchema, {
        ...input,
        id: newId("CL"),
        cycleId,
        date: todayIso(),
        by: currentActorId(),
      });
      set((s) => {
        s.cultureLogs.push(log);
      });
      audit("create", "culture-log", `D${log.day} culture log entry`, cycleId);
      return log;
    },
    renewConsent: (positionId, months) => {
      assert(months >= 1 && months <= 60, "Renew for 1–60 months");
      const pos = get().storage.find((p) => p.id === positionId);
      if (!pos) throw new DomainError("Storage position not found");
      const base = pos.consentExpiry > todayIso() ? pos.consentExpiry : todayIso();
      set((s) => {
        const p = s.storage.find((x) => x.id === positionId);
        if (p) p.consentExpiry = shiftDate(base, Math.round(months * 30.4));
      });
      audit("update", "storage", `Renewed storage consent for ${pos.label} by ${months} months`, positionId);
    },
    recordTransfer: (embryoIds, procedureLabel) => {
      const eligible = get().embryos.filter(
        (e) => embryoIds.includes(e.id) && (e.status === "culturing" || e.status === "thawed"),
      );
      if (eligible.length === 0) return;
      set((s) => {
        s.embryos.forEach((e) => {
          if (eligible.some((x) => x.id === e.id)) {
            e.status = "transferred";
            s.custody.push(custody(e.id, "transferred", `Transferred during ${procedureLabel}`, currentActorId()));
          }
        });
      });
      audit(
        "update",
        "embryo",
        `Recorded transfer of ${eligible.map((e) => e.label).join(", ")}`,
        eligible[0]?.cycleId,
      );
    },
    reset: (seed = getSeed()) =>
      set((s) => {
        s.embryos = seed.embryos;
        s.storage = seed.storage;
        s.cultureLogs = seed.cultureLogs;
        s.custody = seed.custody;
      }),
  };
});
